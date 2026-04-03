import { getAmazonClient } from '../amazon/client';
import { getProductsMeta, queryOrdersFromDB, getPendingOrdersFromDB, recordSync, upsertOrders } from '../supabase/orders-repository';
import { InventoryRow, Order, OrderItem } from '@/types';

// Cache global simples para o sumário do dashboard e preços live
let globalCache: {
  summary?: { data: any; timestamp: number };
  inventory?: { data: InventoryRow[]; timestamp: number };
  livePrices?: { data: Map<string, number>; timestamp: number };
} = {};

const LIVE_PRICES_CACHE_TTL = 2 * 60 * 1000; // 2 minutos para precisão nos testes

function isCacheFresh(timestamp?: number) {
  if (!timestamp) return false;
  return Date.now() - timestamp < LIVE_PRICES_CACHE_TTL;
}

/**
 * Busca os preços atuais de uma lista de ASINs via SP-API (Product Pricing).
 * Faz o processamento em lotes de 20 (limite da Amazon).
 */
export async function fetchLivePrices(asins: string[]): Promise<Map<string, { price?: number; error?: string }>> {
  if (!asins.length) return new Map();
  
  // Cache por ASIN para evitar consultas repetitivas no mesmo ciclo
  const liveResults = new Map<string, { price?: number; error?: string }>();
  
  if (isCacheFresh(globalCache.livePrices?.timestamp)) {
    // Convertemos o Map de cache (que era só number) para o novo formato se necessário
    const cached = globalCache.livePrices!.data as any;
    return cached;
  }

  const amz = getAmazonClient();
  if (!amz) return liveResults;

  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  if (!marketplaceId) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Pricing] Marketplace ID não configurado. Pulando fetch de preços live.');
    }
    return liveResults;
  }
  
  for (let i = 0; i < asins.length; i += 20) {
    const batch = asins.slice(i, i + 20);
    try {
      const results = await Promise.all(
        batch.map(async (asin) => {
          if (!asin || asin === 'NONE' || asin === '...') return { asin, error: 'ASIN inválido' };
          
          try {
            // Operação getPricing (v0) - Padrão estabilizado: Asins como array plural
            const resp = await amz.callAPI({
              operation: 'getPricing',
              endpoint: 'productPricing',
              query: { 
                MarketplaceId: marketplaceId,
                ItemType: 'Asin',
                Asins: [asin]
              }
            });

            const payload = resp.payload || resp;
            const product = payload.Product || (Array.isArray(payload) ? payload[0]?.Product : null);
            
            let price = product?.Offers?.[0]?.BuyingPrice?.ListingPrice?.Amount || 
                        product?.Offers?.[0]?.RegularPrice?.Amount;

            // Fallback para CompetitivePricing se o preço do vendedor não estiver disponível
            if (!price) {
              const compResp = await amz.callAPI({
                operation: 'getCompetitivePricing',
                endpoint: 'productPricing',
                query: { 
                  MarketplaceId: marketplaceId,
                  ItemType: 'Asin',
                  Asins: [asin]
                }
              });
              const compPayload = compResp.payload || compResp;
              const compProd = compPayload.Product || (Array.isArray(compPayload) ? compPayload[0]?.Product : null);
              price = compProd?.CompetitivePricing?.CompetitivePrices?.[0]?.Price?.LandedPrice?.Amount;
            }

            if (price) return { asin, price: parseFloat(price) };
            return { asin, error: 'Preço não encontrado no JSON' };
          } catch (err: any) {
            return { asin, error: err.message || 'Erro na chamada' };
          }
        })
      );

      results.forEach(res => {
        if (res) liveResults.set(res.asin, { price: res.price, error: res.error });
      });
    } catch (err) {
      console.error(`[Pricing] Erro crítico no lote ${i}:`, err);
    }
  }

  globalCache.livePrices = { data: liveResults as any, timestamp: Date.now() };
  return liveResults;
}

/**
 * Calcula o total do pedido com estratégia de fallback.
 * Prioriza o Preço Atual (Live) para pedidos pendentes.
 */
export function calculateOrderTotal(o: any, items: any[], inventory: InventoryRow[] = [], livePrices: Map<string, { price?: number; error?: string }> = new Map()): number {
  if (o.total && o.total > 0) return o.total;

  const itemsTotal = items.reduce((sum, i) => sum + (i.price * i.quantity || 0), 0);
  if (itemsTotal > 0) return itemsTotal;

  // Fallback: Preço Atual (Live) > Preço Médio (Histórico)
  const fallbackTotal = items.reduce((sum, i) => {
    const liveResult = livePrices.get(i.asin);
    const livePrice = liveResult?.price;
    if (livePrice) return sum + (livePrice * i.quantity);

    const invItem = inventory.find(inv => inv.asin === i.asin || inv.sku === i.sku);
    return sum + ((invItem?.avg_price || 0) * i.quantity);
  }, 0);

  return fallbackTotal;
}

export async function getDashboardSummary(range: string = '30d', from?: string, to?: string) {
  const now = new Date();
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  
  if (marketplaceId) {
    const amz = getAmazonClient();
    if (amz) {
      // Gatilho para buscar novos pedidos (cooldown 5m)
      checkAndTriggerNewOrdersSync(marketplaceId);
      // Gatilho de sincronização bi-diária para atualizar status (cooldown 12h)
      checkAndTriggerStatusSync(marketplaceId);
    } else {
      console.warn('[Dashboard] Amazon Client não pode ser inicializado para marketplaceId:', marketplaceId);
    }
  } else {
    console.warn('[Dashboard] AMAZON_MARKETPLACE_ID está ausente no ambiente.');
  }
  
  // Normalização para início do dia atual (00:00)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  
  let startDate = new Date();
  let endDate: Date | undefined = undefined;
  let label = '30 Dias';

  switch (range) {
    case 'today': 
      startDate = todayStart;
      label = 'Hoje'; 
      break;
    case 'yesterday': 
      startDate = new Date(todayStart);
      startDate.setDate(todayStart.getDate() - 1);
      endDate = new Date(todayStart);
      endDate.setMilliseconds(-1); // 23:59:59.999 do dia anterior
      label = 'Ontem'; 
      break;
    case '7d': 
      startDate = new Date(todayStart);
      startDate.setDate(todayStart.getDate() - 7); 
      label = '7 Dias'; 
      break;
    case '15d': 
      startDate = new Date(todayStart);
      startDate.setDate(todayStart.getDate() - 15); 
      label = '15 Dias'; 
      break;
    case '30d': 
      startDate = new Date(todayStart);
      startDate.setDate(todayStart.getDate() - 30); 
      label = '30 Dias'; 
      break;
    case '90d': 
      startDate = new Date(todayStart);
      startDate.setDate(todayStart.getDate() - 90); 
      label = '90 Dias'; 
      break;
    default: 
      startDate = new Date(todayStart);
      startDate.setDate(todayStart.getDate() - 30);
  }

  const diagnostics = {
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    amazon: !!(process.env.AMAZON_CLIENT_ID && process.env.AMAZON_CLIENT_SECRET && process.env.AMAZON_REFRESH_TOKEN),
    marketplace: !!process.env.AMAZON_MARKETPLACE_ID,
  };

  try {
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
    if (!marketplaceId) return { chartData: [], rangeLabel: 'Erro', diagnostics };

    const orders = await queryOrdersFromDB(marketplaceId, startDate, endDate);
    const inventory = await getInventory();
    
    // Busca preços live para os ASINs do catálogo para melhor estimativa de pendentes
    const allAsins = Array.from(new Set(inventory.map(i => i.asin)));
    const livePrices = await fetchLivePrices(allAsins);

    const orderStats = orders
      .filter(o => o.status !== 'canceled')
      .map(o => {
        const raw = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
        // Normalização Universal: Suporta camelCase e PascalCase (Amazon Nativa)
        const rawItems = (raw.items || raw.OrderItems || []) as any[];
        const items = rawItems.map(i => ({
          title: i.title || i.Title || `Pedido ${o.id}`,
          asin:  i.asin  || i.ASIN,
          sku:   i.sku   || i.SellerSKU || '...',
          quantity: i.quantity || i.QuantityOrdered || 1,
          price: i.price || i.ItemPrice?.Amount || 0
        }));
        
        // Agora usa livePrices como prioridade na estimativa
        const total = calculateOrderTotal(o, items, inventory, livePrices);
      
        const units = items.length > 0 
          ? items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0)
          : (o.num_items_shipped || 0);

        return { ...o, total, units, items };
      });

    const totalOrders = orderStats.length;
    const totalSales = orderStats.reduce((acc, o) => acc + o.total, 0);
    const totalUnits = orderStats.reduce((acc, o) => acc + o.units, 0);

    const dailyMap = new Map<string, { sales: number; orders: number; units: number }>();
    
    // Auxiliar para preencher o mapa com períodos vazios (24h ou N dias)
    if (range === 'today' || range === 'yesterday') {
      for (let h = 0; h < 24; h++) {
        const label = `${h.toString().padStart(2, '0')}h`;
        dailyMap.set(label, { sales: 0, orders: 0, units: 0 });
      }
    } else {
      // Preenche com os dias do intervalo (da startDate até hoje ou endDate)
      const current = new Date(startDate);
      const limit = endDate || now;
      while (current <= limit) {
        const label = current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dailyMap.set(label, { sales: 0, orders: 0, units: 0 });
        current.setDate(current.getDate() + 1);
      }
    }

    orderStats.forEach(o => {
      const d = new Date(o.created_at);
      let label = '';
      
      if (range === 'today' || range === 'yesterday') {
        label = `${d.getHours().toString().padStart(2, '0')}h`;
      } else {
        label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      }
      
      const stats = dailyMap.get(label);
      if (stats) {
        stats.sales += o.total;
        stats.orders += 1;
        stats.units += o.units;
      }
    });

    const chartData = Array.from(dailyMap.entries())
      .map(([label, stats]) => ({
        label,
        sales: stats.sales,
        orders: stats.orders,
        units: stats.units
      }));

    // Só ordena se não for 24h (que já está na ordem 00-23)
    if (range !== 'today' && range !== 'yesterday') {
      chartData.sort((a, b) => {
        // Assume DD/MM (mais simples ordenar por data se necessário, mas preenchimento já está em ordem)
        return 0; 
      });
    }

    return {
      vendas_hoje:      totalSales,
      vendas_hoje_var:  0,
      pedidos_hoje:     totalOrders,
      pedidos_hoje_var: 0,
      unidades_vendidas: totalUnits,
      unidades_var:     0,
      ticket_medio:     totalUnits > 0 ? totalSales / totalUnits : 0,
      ticket_medio_var: 0,
      estoque_valorizado: inventory.reduce((acc, i) => acc + i.total_cost, 0),
      skus_ativos:      inventory.filter(i => i.status === 'active' || i.status === 'at_risk').length,
      skus_em_risco:    inventory.filter(i => i.status === 'at_risk' || i.status === 'out_of_stock').length,
      capital_necessario: inventory.reduce((acc, i) => acc + i.restock_cost, 0),
      chartData,
      rangeLabel: label,
      diagnostics
    };
  } catch (error) {
    console.error('[Dashboard] Erro crítico em getDashboardSummary:', error);
    return { 
      chartData: [], 
      rangeLabel: 'Erro de Processamento', 
      diagnostics: { 
        supabase: false, amazon: false, marketplace: false, error: String(error) 
      } 
    };
  }
}

export async function getInventory(): Promise<InventoryRow[]> {
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  if (!marketplaceId) {
    console.warn('[Inventory] AMAZON_MARKETPLACE_ID não configurado. Retornando lista vazia.');
    return [];
  }
  const amz = getAmazonClient();
  
  let summaries: any[] = [];
  let nextToken: string | undefined = undefined;

  if (amz) {
    try {
      let response: any;
      do {
        response = await amz.callAPI({
          operation: 'getInventorySummaries',
          endpoint: 'fbaInventory',
          query: {
            granularityType: 'Marketplace',
            granularityId: marketplaceId,
            marketplaceIds: [marketplaceId],
            details: true,
            ...(nextToken ? { nextToken } : {})
          }
        });
        const pageItems = response.payload?.inventorySummaries || response.inventorySummaries || [];
        summaries = [...summaries, ...pageItems];
        nextToken = response.payload?.pagination?.nextToken || response.pagination?.nextToken;
      } while (nextToken);
    } catch (err) { console.error("[Inventory] Erro Amazon:", err); }
  }

  const window30 = new Date();
  window30.setDate(window30.getDate() - 30);
  let orders30d: any[] = [];
  try {
    orders30d = await queryOrdersFromDB(marketplaceId, window30);
  } catch (err) { console.error("[Inventory] Erro Supabase:", err); }

  const salesByAsin = new Map<string, { units: number; total: number; firstSale: string }>();
  
  orders30d.forEach(o => {
    if (o.status === 'canceled') return;
    const date = o.created_at;
    const raw = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
    const items = raw.items || raw.OrderItems || [];
    const hasRealRevenue = o.total > 0;
    
    items.forEach((i: any) => {
      const asin = i.asin || i.ASIN || 'NONE'; 
      const current = salesByAsin.get(asin) || { units: 0, total: 0, firstSale: date };
      const oldest = date < current.firstSale ? date : current.firstSale;
      const unitRevenue = hasRealRevenue
        ? ((i.price || i.ItemPrice?.Amount || 0) > 0 ? (i.price || i.ItemPrice?.Amount || 0) * (i.quantity || i.QuantityOrdered || 1) : (o.total / (o.num_items_shipped || items.length)) * (i.quantity || 1))
        : 0;
      salesByAsin.set(asin, {
        units: current.units + (i.quantity || i.QuantityOrdered || 0),
        total: current.total + unitRevenue,
        firstSale: oldest
      });
    });
  });

  const allAsinsFromInventory = Array.from(new Set(summaries.map(s => s.asin)));
  const allAsinsFromSales = Array.from(salesByAsin.keys());
  const allAsins = Array.from(new Set([...allAsinsFromInventory, ...allAsinsFromSales]));
  
  const [metaList, livePrices] = await Promise.all([
    getProductsMeta(allAsins),
    fetchLivePrices(allAsins)
  ]);

  const metaMap = new Map<string, any>(metaList.map(m => [m.asin, m]));
  const aggregated = new Map<string, InventoryRow>();

  summaries.forEach((item: any) => {
    const asin = item.asin;
    const available = item.inventoryDetails?.fulfillableQuantity ?? item.totalQuantity ?? 0;
    const in_transit = item.inventoryDetails?.inboundReceivingQuantity || 0;
    
    if (aggregated.has(asin)) {
      const e = aggregated.get(asin)!;
      e.available += available;
      e.in_transit += in_transit;
    } else {
      aggregated.set(asin, {
        asin,
        sku: item.sellerSku,
        title: item.productName || `Produto ${item.sellerSku}`,
        fulfillment: 'FBA', available, in_transit,
        sales_velocity: 0, coverage_days: 0, risk_level: 'healthy', status: 'active',
        unit_cost: 0, total_cost: 0, avg_price: 0, 
        current_price: 0, price_source: 'historical',
        potential_revenue: 0,
        restock_quantity: 0, restock_cost: 0, lead_time_days: 0, units_30d: 0,
        last_updated: item.lastUpdatedTime
      });
    }
  });

  salesByAsin.forEach((stats, asin) => {
    if (asin !== 'NONE' && !aggregated.has(asin)) {
      aggregated.set(asin, {
        asin,
        sku: '...',
        title: `ASIN: ${asin}`,
        fulfillment: 'FBA', available: 0, in_transit: 0,
        sales_velocity: 0, coverage_days: 0, risk_level: 'critical', status: 'out_of_stock',
        unit_cost: 0, total_cost: 0, avg_price: 0, 
        current_price: 0, price_source: 'historical',
        potential_revenue: 0,
        restock_quantity: 0, restock_cost: 0, lead_time_days: 0, units_30d: 0,
      });
    }
  });

  const globalSales = salesByAsin.get('NONE');
  const inventory: InventoryRow[] = Array.from(aggregated.values());

  inventory.forEach(row => {
    let stats = salesByAsin.get(row.asin);
    if (!stats && globalSales && inventory.length === 1) stats = globalSales;

    const meta = metaMap.get(row.asin);
    
    // Priorização: Metadados do Banco > Dados da Amazon API (que costumam vir incompletos)
    if (meta?.title) row.title = meta.title;
    if (meta?.sku && (!row.sku || row.sku === '...' || row.sku === 'NONE')) row.sku = meta.sku;

    row.units_30d = stats?.units || 0;
    row.avg_price = row.units_30d > 0 ? (stats!.total / row.units_30d) : 0;
    
    // Prioriza Preço Live obtido via SP-API
    const liveResult = livePrices.get(row.asin);
    row.current_price = liveResult?.price || row.avg_price;
    row.price_source = liveResult?.price ? 'live' : 'historical';

    row.unit_cost = meta?.unit_cost || 0;
    row.lead_time_days = meta?.lead_time_days || 0;
    
    let divisor = 30;
    if (stats?.firstSale) {
      const first = new Date(stats.firstSale);
      const days = (new Date().getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
      if (days < 30) divisor = Math.max(1, Math.round(days * 10) / 10);
    }
    
    row.sales_velocity = row.units_30d / divisor;
    row.units_30d = Math.round(row.sales_velocity * 30);
    row.total_cost = row.available * row.unit_cost;
    row.potential_revenue = row.available * row.current_price;

    if (row.sales_velocity > 0) {
      row.coverage_days = Math.round(row.available / row.sales_velocity);
      const target = Math.ceil(row.sales_velocity * 30);
      row.restock_quantity = Math.max(0, target - (row.available + row.in_transit));
      row.restock_cost = row.restock_quantity * row.unit_cost;
    } else {
      row.coverage_days = row.available > 0 ? 999 : 0;
      row.restock_quantity = 0; row.restock_cost = 0;
    }

    if (row.available > 0) {
      if (row.lead_time_days > 0 && row.coverage_days < row.lead_time_days) {
        row.status = 'at_risk'; row.risk_level = 'critical';
      } else {
        row.status = 'active';
        row.risk_level = row.coverage_days < 15 ? 'critical' : (row.coverage_days < 30 ? 'warning' : 'healthy');
      }
    } else {
      row.status = row.units_30d > 0 ? 'out_of_stock' : 'inactive';
      row.risk_level = row.units_30d > 0 ? 'critical' : 'healthy';
    }
  });

  return inventory;
}

/**
 * getAlerts
 * Centraliza a inteligência de notificações operacionais da plataforma.
 * Gera alertas dinâmicos baseados no estado do inventário e pedidos.
 */
export async function getAlerts() {
  const inventory = await getInventory();
  const alerts: any[] = [];
  const now = new Date();

  // 1. Alerta de Ruptura — Dinâmico baseado na cobertura
  const criticalStock = inventory.filter(i => (i.coverage_days ?? 99) < 5 && i.status !== 'inactive');
  criticalStock.forEach(i => {
    alerts.push({
      id:          `stock-rupture-${i.asin}`,
      title:       'Ruptura Iminente',
      description: `O item ${i.sku} (${i.asin}) tem cobertura estimada de apenas ${Math.floor(i.coverage_days || 0)} dias.`,
      severity:    'critical',
      created_at:  now.toISOString(),
      is_read:     false,
      reference_id: i.sku
    });
  });

  // 2. Alertas Fixos/Contextuais (Simulação de Inbox operacional futuro)
  // Nota: Estes poderiam vir de uma tabela 'amazon_alerts' no Supabase
  alerts.push({
    id:          'shipment-transit-default',
    title:       'Shipment em Trânsito',
    description: 'Um envio FBA está em trânsito há mais de 15 dias. Verifique possíveis atrasos de recebimento.',
    severity:    'high',
    created_at:  new Date(now.getTime() - 80 * 60000).toISOString(), // 1h20 atrás
    is_read:     false,
    reference_id: 'FBA-TRACK-99'
  });

  alerts.push({
    id:          'refund-update-default',
    title:       'Atualização de Reembolso',
    description: 'Processamento de devoluções concluído para 3 pedidos das últimas 24h.',
    severity:    'info',
    created_at:  new Date(now.getTime() - 180 * 60000).toISOString(), // 3h atrás
    is_read:     true
  });

  // Ordena por severidade (critical -> high -> info) e data
  const severityOrder = { critical: 0, high: 1, info: 2 };
  return alerts.sort((a, b) => {
    const sevDiff = (severityOrder[a.severity as keyof typeof severityOrder] || 9) - 
                    (severityOrder[b.severity as keyof typeof severityOrder] || 9);
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function getOrders(daysAgo: number): Promise<Order[]> {
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  if (!marketplaceId) {
    console.warn('[Orders] Marketplace ID ausente em getOrders');
    return [];
  }

  const amz = getAmazonClient();
  if (amz) {
    // Gatilho para buscar novos pedidos (cooldown 5m)
    checkAndTriggerNewOrdersSync(marketplaceId);
    // Gatilho de sincronização bi-diária para atualizar status (cooldown 12h)
    checkAndTriggerStatusSync(marketplaceId);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const startDate = new Date(todayStart);
  startDate.setDate(todayStart.getDate() - daysAgo);
  
  try {
    const inventory = await getInventory();
    
    const allAsins = Array.from(new Set(inventory.map(i => i.asin)));
    const livePrices = await fetchLivePrices(allAsins);

    const ordersRaw = await queryOrdersFromDB(marketplaceId, startDate);
    
    return ordersRaw.map((o: any): Order => {
      // 1. Extração profunda do payload (resolvendo duplicatas e aninhamentos)
      const raw = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
      
      // 2. Localização redundante da lista de itens (suporta OrderItems, items e raw_payload interno)
      const itemsListCandidate = raw.items || raw.OrderItems || o.items || [];
      const rawItems = Array.isArray(itemsListCandidate) ? itemsListCandidate : [];
      
      // 3. Normalização Universal de cada Item (Recuperação de nomes e SKUs)
      const normalizedItems: OrderItem[] = rawItems.map((i: any) => {
        const asinVal = i.asin || i.ASIN || '...';
        const skuVal  = i.sku  || i.SellerSKU || '...';
        
        // Prioridade de Título: títuo interno > título Amazon > fallback ASIN
        const titleVal = i.title || i.Title || 
                         inventory.find(inv => inv.asin === asinVal)?.title || 
                         `Item ${asinVal}`;

        return {
          sku: skuVal,
          asin: asinVal,
          title: titleVal,
          quantity: i.quantity || i.QuantityOrdered || 0,
          price: i.price || i.ItemPrice?.Amount ? parseFloat(i.ItemPrice?.Amount || i.price) : 0,
          image_url: i.image_url
        };
      });

      return {
        id: o.id,
        amazon_order_id: o.amazon_order_id,
        created_at: o.created_at,
        status: o.status as any,
        fulfillment_channel: (o.fulfillment_channel || 'FBA') as any,
        total: calculateOrderTotal(o, normalizedItems, inventory, livePrices),
        items: normalizedItems
      };
    });
  } catch (error) {
    console.error('[Dashboard] Erro em getOrders:', error);
    return [];
  }
}

export async function getPricing() {
  try {
    const inventory = await getInventory();
    const allAsins = Array.from(new Set(inventory.map(i => i.asin)));
    const liveResults = await fetchLivePrices(allAsins);

    return inventory
      .filter(row => row.status !== 'inactive' || row.available > 0)
      .map(row => {
        const avgPrice = row.avg_price || 0;
        const liveResult = liveResults.get(row.asin);
        const livePriceValue = liveResult?.price;
        
        const current_price = livePriceValue || avgPrice;
        const price_source: 'live' | 'historical' = livePriceValue ? 'live' : 'historical';
        
        // Margem estimada com base no preco mais atualizado
        const margin = current_price > 0 && row.unit_cost > 0
          ? Math.round(((current_price - row.unit_cost) / current_price) * 100)
          : 0;

        const min_price = row.unit_cost > 0 ? +(row.unit_cost * 1.15).toFixed(2) : +(current_price * 0.85).toFixed(2);
        const max_price = +(current_price * 1.20).toFixed(2);

        const status: 'optimized' | 'needs_action' | 'paused' =
          margin >= 15 ? 'optimized' : 'needs_action';

        return {
          sku: row.sku,
          asin: row.asin,
          title: row.title,
          current_price: +current_price.toFixed(2),
          avg_price: +avgPrice.toFixed(2),
          min_price,
          max_price,
          buybox_price: null,
          competitor_price: null,
          margin_percentage: margin,
          has_buybox: row.status === 'active',
          status,
          price_source,
          debug_info: liveResult?.error || (livePriceValue ? undefined : 'Sem dado na API')
        };
      });
  } catch (error) {
    console.error('[Dashboard] Erro em getPricing:', error);
    return [];
  }
}

/**
 * Busca os itens de cada pedido em lote para garantir nomes reais de produtos.
 * Implementa delay de 500ms entre chamadas para evitar rate limit (0.5 req/s).
 */
export async function fetchOrderItems(orderIds: string[]): Promise<Record<string, any[]>> {
  const amz = getAmazonClient();
  if (!amz || orderIds.length === 0) return {};

  const orderItemsMap: Record<string, any[]> = {};
  
  for (const orderId of orderIds) {
    try {
      const response = await amz.callAPI({
        operation: 'getOrderItems',
        endpoint: 'orders',
        path: { orderId }
      });

      const payload = response.payload || response;
      const itemsList = payload.OrderItems || payload.items || [];
      orderItemsMap[orderId] = itemsList.map((item: any) => {
        return {
          title: item.title || item.Title || `Item ${orderId}`,
          asin:  item.asin  || item.ASIN,
          sku:   item.sku   || item.SellerSKU || '...',
          quantity: item.quantity || item.QuantityOrdered || 0,
          price: item.price || item.ItemPrice?.Amount ? parseFloat(item.ItemPrice?.Amount || item.price) : 0
        };
      });

      // Respeita o rate limit da Amazon (0.5 req/s para getOrderItems)
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.warn(`[Sync] Falha ao buscar itens para pedido ${orderId}:`, e);
      orderItemsMap[orderId] = [];
    }
  }

  return orderItemsMap;
}

/**
 * Sincroniza o status e o valor real de faturamento para pedidos pendentes. 
 */
export async function syncPendingOrders(marketplaceId: string) {
  const amz = getAmazonClient();
  if (!amz) return;

  try {
    const pendingRows = await getPendingOrdersFromDB(marketplaceId);
    if (!pendingRows.length) return;

    const orderIds = pendingRows.map(r => r.id);
    
    // Amazon permite até 50 IDs por chamada getOrders
    for (let i = 0; i < orderIds.length; i += 50) {
      const batchIds = orderIds.slice(i, i + 50);
      
      const response = await amz.callAPI({
        operation: 'getOrders',
        endpoint: 'orders',
        query: {
          MarketplaceIds: [marketplaceId],
          AmazonOrderIds: batchIds
        }
      });

      const updatedOrders = response.payload?.Orders || response.Orders || [];
      if (updatedOrders.length > 0) {
        // Para os pedidos que mudaram de status ou precisam de atualização, 
        // buscamos os itens se eles não estiverem presentes no raw_payload atual
        const itemsMap = await fetchOrderItems(updatedOrders.map((o: any) => o.AmazonOrderId));

        // NOVO: Propaga os nomes dos produtos para a tabela de catálogo global (Estoque)
        const { upsertProductMeta } = await import('../supabase/orders-repository');
        for (const oId of Object.keys(itemsMap)) {
          const items = itemsMap[oId];
          for (const item of items) {
            if (item.asin && item.title && !item.title.includes('Sincronizando') && !item.title.includes('Pedido ')) {
              await upsertProductMeta({
                asin: item.asin,
                sku: item.sku || '...',
                title: item.title,
                unit_cost: 0, // Mantém o custo atual se já existir via conflict handling
              });
            }
          }
        }

        // Limpa cache para refletir no Dashboard
        globalCache.summary = undefined;
        globalCache.inventory = undefined;

        const rowsToUpsert = updatedOrders.map((o: any) => {
          const total = o.OrderTotal?.Amount ? parseFloat(o.OrderTotal.Amount) : 0;
          return {
            id:                  o.AmazonOrderId,
            amazon_order_id:     o.AmazonOrderId,
            marketplace_id:      marketplaceId,
            created_at:          o.PurchaseDate,
            status:              o.OrderStatus,
            fulfillment_channel: o.FulfillmentChannel || 'FBA',
            total:               total,
            currency:            o.OrderTotal?.CurrencyCode || 'BRL',
            num_items_shipped:   o.NumberOfItemsShipped || 0,
            num_items_unshipped: o.NumberOfItemsUnshipped || 0,
            raw_payload:         { ...o, items: itemsMap[o.AmazonOrderId] || [] }, 
            updated_at:          new Date().toISOString()
          };
        });

        const { upsertOrders } = await import('../supabase/orders-repository');
        await upsertOrders(rowsToUpsert);
      }
    }

    await recordSync(marketplaceId, { sync_type: 'refresh_status', orders_updated: orderIds.length });
  } catch (error) {
    console.error('[Sync] Erro total em syncPendingOrders:', error);
  }
}

/**
 * Sincroniza novos pedidos criados desde a última execução bem-sucedida.
 * Utiliza o parâmetro CreatedAfter para captura incremental.
 */
export async function syncNewOrders(marketplaceId: string) {
  const amz = getAmazonClient();
  if (!amz) return;

  try {
    const { getLastSyncByType } = await import('../supabase/orders-repository');
    // Busca o último sync (seja full ou incremental)
    const lastSync = await getLastSyncByType(marketplaceId, 'all'); 
    
    // Fallback: Se nunca sincronizou, pega os últimos 7 dias para não estourar a API no primeiro acesso
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 7);
    
    const createdAfter = lastSync || defaultStart;

    let nextToken: string | undefined = undefined;
    let totalFetched = 0;

    do {
      const query: any = { MarketplaceIds: [marketplaceId] };
      if (nextToken) {
        query.NextToken = nextToken;
      } else {
        query.CreatedAfter = createdAfter.toISOString();
      }

      const response = await amz.callAPI({ operation: 'getOrders', endpoint: 'orders', query });
      const batch = response.payload?.Orders || response.Orders || [];
      
      if (batch.length > 0) {
        // Busca itens para este lote de pedidos
        const itemsMap = await fetchOrderItems(batch.map((o: any) => o.AmazonOrderId));

        const { mapRawOrdersForBackfill } = await import('./backfill-helpers');
        const { toOrderRow, upsertOrders } = await import('../supabase/orders-repository');
        
        // Mapeia PascalCase (Amazon) para formato interno (snake_case)
        const batchWithItems = batch.map((o: any) => ({ ...o, items: itemsMap[o.AmazonOrderId] || [] }));
        const mappedOrders = mapRawOrdersForBackfill(batchWithItems);
        const rows = mappedOrders.map((o: any) => toOrderRow(o, marketplaceId));
        
        // NOVO: Propaga os nomes dos produtos para o catálogo de Estoque
        const { upsertProductMeta } = await import('../supabase/orders-repository');
        for (const oId of Object.keys(itemsMap)) {
          const items = itemsMap[oId];
          for (const item of items) {
            if (item.asin && item.title && !item.title.includes('Sincronizando') && !item.title.includes('Pedido ')) {
              await upsertProductMeta({
                asin: item.asin,
                sku: item.sku || '...',
                title: item.title,
              });
            }
          }
        }

        // Salva backfill no DB e limpa cache
        await upsertOrders(rows);
        globalCache.summary = undefined;
        globalCache.inventory = undefined;
        totalFetched += batch.length;
      }

      nextToken = response.payload?.NextToken || response.NextToken;
    } while (nextToken);

    if (totalFetched > 0) {
      await recordSync(marketplaceId, { sync_type: 'incremental', orders_fetched: totalFetched });
    } else {
      // Mesmo que zero, registra um pulso para evitar re-tentativas imediatas
      await recordSync(marketplaceId, { sync_type: 'incremental_pulse', orders_fetched: 0 });
    }
  } catch (error) {
    console.error('[Sync] Erro em syncNewOrders:', error);
  }
}

/**
 * Gatilho para buscar novos pedidos. Cooldown de 5 minutos para evitar chamadas excessivas.
 */
async function checkAndTriggerNewOrdersSync(marketplaceId: string) {
  const { getLastSyncByType } = await import('../supabase/orders-repository');
  // Verifica qualquer tipo de sync de pedidos
  const lastSync = await getLastSyncByType(marketplaceId, 'any_order_sync');
  
  const FIVE_MINUTES = 5 * 60 * 1000;
  if (!lastSync || (Date.now() - lastSync.getTime() > FIVE_MINUTES)) {
    console.log('[Sync] Buscando novos pedidos na Amazon...');
    syncNewOrders(marketplaceId);
  }
}

/**
 * Gatilho que verifica se passarem 12h desde o último refresh de status.
 */
async function checkAndTriggerStatusSync(marketplaceId: string) {
  const { getLastSyncByType } = await import('../supabase/orders-repository');
  const lastSync = await getLastSyncByType(marketplaceId, 'refresh_status');
  
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  if (!lastSync || (Date.now() - lastSync.getTime() > TWELVE_HOURS)) {
    console.log('[Sync] Disparando refresh bi-diário de status de pedidos...');
    syncPendingOrders(marketplaceId); 
  }
}
