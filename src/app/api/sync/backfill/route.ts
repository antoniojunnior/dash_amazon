import { NextRequest, NextResponse } from 'next/server';
import { getAmazonClient } from '@/lib/amazon/client';
import { mapRawOrdersForBackfill } from '@/lib/api/backfill-helpers';
import {
  upsertOrders,
  recordSync,
  toOrderRow,
  getLastSyncTime,
} from '@/lib/supabase/orders-repository';

/**
 * GET /api/sync/backfill?days=60&secret=...
 *
 * Endpoint de backfill histórico. Executa UMA VEZ para popular o Supabase
 * com todo o histórico de pedidos da janela solicitada (padrão: 60 dias).
 *
 * Parâmetros:
 *   days   — Janela histórica em dias (padrão: 60)
 *   force  — Se "true", refaz o backfill mesmo que já exista sync registrado
 *
 * Proteção mínima: requer o header ou query param `secret` igual à
 * variável de ambiente BACKFILL_SECRET (se configurada).
 */
export async function GET(request: NextRequest) {
  // ── Proteção simples por secret ────────────────────────────────────────────
  const secret = process.env.BACKFILL_SECRET;
  if (secret) {
    const provided = request.nextUrl.searchParams.get('secret');
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID!;
  const daysParam     = request.nextUrl.searchParams.get('days');
  const forceParam    = request.nextUrl.searchParams.get('force') === 'true';
  const daysAgo       = Math.min(parseInt(daysParam ?? '60', 10), 180); // máx 180 dias

  const amz = getAmazonClient();
  if (!amz) {
    return NextResponse.json({ error: 'Amazon client não configurado.' }, { status: 500 });
  }

  // ── Verifica se já existe histórico e force não foi solicitado ─────────────
  if (!forceParam) {
    const lastSync = await getLastSyncTime(marketplaceId);
    if (lastSync) {
      return NextResponse.json({
        skipped: true,
        reason:  'Já existe sync registrado. Use ?force=true para refazer o backfill.',
        lastSync: lastSync.toISOString(),
      });
    }
  }

  const createdAfter = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const startedAt    = Date.now();

  console.log(`[Backfill] Iniciando backfill completo de ${daysAgo} dias (desde ${createdAfter.toISOString()})`);

  // ── Paginação completa via NextToken ───────────────────────────────────────
  let allRaw: any[]             = [];
  let nextToken: string | undefined = undefined;
  let page                      = 0;
  const pageLog: string[]       = [];

  try {
    do {
      page++;
      const query: Record<string, any> = {
        MarketplaceIds: [marketplaceId],
      };
      if (nextToken) {
        query.NextToken = nextToken;
      } else {
        query.CreatedAfter = createdAfter.toISOString();
      }

      const response = await amz.callAPI({ operation: 'getOrders', endpoint: 'orders', query });
      const batch    = response.payload?.Orders || response.Orders || response.orders || [];
      allRaw         = allRaw.concat(batch);
      nextToken      = response.payload?.NextToken || response.NextToken;

      const msg = `Página ${page}: ${batch.length} pedidos (acumulado: ${allRaw.length})`;
      console.log(`[Backfill] ${msg}`);
      pageLog.push(msg);

    } while (nextToken);

    // ── Upsert em lotes de 200 (evita payload gigante no Supabase) ───────────
    const orders   = mapRawOrdersForBackfill(allRaw);
    const rows     = orders.map((o: any) => toOrderRow(o, marketplaceId));
    const BATCH    = 200;
    let upserted   = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      await upsertOrders(slice);
      upserted += slice.length;
      console.log(`[Backfill] Upsert lote ${Math.ceil((i + 1) / BATCH)}: ${upserted}/${rows.length}`);
    }

    // ── Grava log de sync ─────────────────────────────────────────────────────
    await recordSync(marketplaceId, {
      ordersFetched: rows.length,
      pagesFetched:  page,
      syncType:      'full',
    });

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

    return NextResponse.json({
      success:       true,
      daysBackfilled: daysAgo,
      totalFetched:  allRaw.length,
      totalUpserted: upserted,
      pagesConsumed: page,
      elapsedSeconds: elapsed,
      pageLog,
    });

  } catch (error: any) {
    console.error('[Backfill] Erro:', error);
    return NextResponse.json(
      { error: 'Backfill falhou', detail: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}
