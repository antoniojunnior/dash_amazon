import { NextRequest, NextResponse } from 'next/server';
import { queryOrdersFromDB, upsertOrders, toOrderRow } from '@/lib/supabase/orders-repository';
import { fetchOrderItems, calculateOrderTotal, getInventory, fetchLivePrices } from '@/lib/api/dashboard';

/**
 * ROTA TEMPORÁRIA DE REPARO (ADMIN)
 * Objetivo: Regularizar pedidos dos últimos 2 dias que ficaram com ID ao invés de Nome ou Valor 0.
 * Uso: Acessar uma única vez no navegador após o deploy.
 */
export async function GET(req: NextRequest) {
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  if (!marketplaceId) {
    return NextResponse.json({ error: 'AMAZON_MARKETPLACE_ID ausente.' }, { status: 500 });
  }

  // Janela de reparo: 48 horas (Ontem e Hoje)
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 2);

  try {
    console.log('[Repair] Iniciando busca de pedidos para reparo...');
    const allOrders = await queryOrdersFromDB(marketplaceId, windowStart);
    
    // Filtro: Pedidos com total 0 OU que tenham o placeholder "Pedido" ou "Sincronizando"
    const ordersToRepair = allOrders.filter(o => {
      const raw = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
      const items = raw.items || [];
      const hasPlaceholder = items.some((i: any) => 
        i.title.includes('Pedido ') || 
        i.title.includes('Sincronizando') ||
        i.sku === '...'
      );
      
      return o.total === 0 || hasPlaceholder || items.length === 0;
    });

    if (ordersToRepair.length === 0) {
      return NextResponse.json({ message: 'Nenhum pedido precisando de reparo foi localizado nas últimas 48h.' });
    }

    console.log(`[Repair] Localizados ${ordersToRepair.length} pedidos. Iniciando busca de itens na Amazon...`);

    // Recursos necessários para o cálculo de valor estimado (Fallback)
    const inventory = await getInventory();
    const asins = Array.from(new Set(inventory.map(i => i.asin)));
    const livePrices = await fetchLivePrices(asins);

    // Busca itens na Amazon (com delay de 500ms cada para evitar rate limit)
    const orderIds = ordersToRepair.map(o => o.amazon_order_id);
    const itemsMap = await fetchOrderItems(orderIds);

    const repairedRows = ordersToRepair.map(o => {
      const items = itemsMap[o.amazon_order_id] || [];
      // Recalcula o total com base nos novos itens + inteligência de preços
      const estimatedTotal = calculateOrderTotal(o, items, inventory, livePrices);
      
      const payload = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
      const updatedPayload = { ...payload, items };

      // Re-mapeia para o formato do banco
      return toOrderRow({ ...o, total: estimatedTotal, raw_payload: updatedPayload }, marketplaceId);
    });

    // Salva de volta no Supabase
    await upsertOrders(repairedRows);

    return NextResponse.json({
      success: true,
      message: `${repairedRows.length} pedidos foram regularizados com sucesso.`,
      details: repairedRows.map(r => ({ id: r.id, total: r.total }))
    });

  } catch (error: any) {
    console.error('[Repair] Falha crítica:', error);
    return NextResponse.json({ 
      error: 'Falha durante o reparo', 
      details: error.message 
    }, { status: 500 });
  }
}
