import { NextRequest, NextResponse } from 'next/server';
import { syncNewOrders, syncPendingOrders } from '@/lib/api/dashboard';

/**
 * Sapphire Cron Endpoint: Sincronização Bi-Diária de Pedidos
 * Este endpoint é acionado pelo Vercel Cron (08:00 e 20:00 UTC).
 * Realiza a captura de novos pedidos e atualiza o status de pedidos pendentes.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Proteção de Elite: Apenas o Vercel Cron (com a secret correta) pode disparar
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('[Cron] Falha de autenticação Sapphire: Token inválido');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  if (!marketplaceId) {
    console.error('[Cron] Erro: AMAZON_MARKETPLACE_ID não configurado');
    return NextResponse.json({ error: 'Marketplace ID missing' }, { status: 500 });
  }

  console.log('[Cron] Iniciando Sincronização Sapphire de Pedidos...');
  
  try {
    // 1. Captura novos pedidos desde o último sync
    await syncNewOrders(marketplaceId);
    
    // 2. Atualiza status de pedidos que ficaram pendentes
    await syncPendingOrders(marketplaceId);

    console.log('[Cron] Sincronização Sapphire concluída com sucesso.');
    
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      action: 'sync_orders_bi_daily'
    });
  } catch (error: any) {
    console.error('[Cron] Erro crítico na Sincronização Sapphire:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
