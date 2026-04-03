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
  
  const liveResults = new Map<string, { price?: number; error?: string }>();
  
  if (isCacheFresh(globalCache.livePrices?.timestamp)) {
    const cached = globalCache.livePrices!.data as any;
    return cached;
  }

  const amz = getAmazonClient();
  if (!amz) return liveResults;

  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  if (!marketplaceId) return liveResults;
  
  for (let i = 0; i < asins.length; i += 20) {
    const batch = asins.slice(i, i + 20);
    try {
      const results = await Promise.all(
        batch.map(async (asin) => {
          if (!asin || asin === 'NONE' || asin === '...') return { asin, error: 'ASIN inválido' };
          
          try {
            const resp = await amz.callAPI({
              operation: 'getPricing',
              endpoint: 'productPricing',
              query: { MarketplaceId: marketplaceId, ItemType: 'Asin', Asins: [asin] }
            });
            const payload = resp.payload || resp;
            const product = payload.Product || (Array.isArray(payload) ? payload[0]?.Product : null);
            let price = product?.Offers?.[0]?.BuyingPrice?.ListingPrice?.Amount || 
                        product?.Offers?.[0]?.RegularPrice?.Amount;
            if (price) return { asin, price: parseFloat(price) };
            return { asin, error: 'Preço não encontrado' };
          } catch (err: any) { return { asin, error: err.message || 'Erro' }; }
        })
      );
      results.forEach(res => { if (res) liveResults.set(res.asin, { price: res.price, error: res.error }); });
    } catch (err) { console.error(`[Pricing] Lote ${i}:`, err); }
  }

  globalCache.livePrices = { data: liveResults as any, timestamp: Date.now() };
  return liveResults;
}

/**
 * Helper unificado para extração e normalização de itens de um pedido.
 * Resolve discrepâncias de casing (Amazon vs. Nosso Banco) e reconstrói nomes via Metadados.
 */
export function extractNormalizedItems(o: any, raw: any, inventory: InventoryRow[] = []): OrderItem[] {
  // 1. Localização redundante (ignora arrays vazios [])
  const itemsListCandidate = (raw.items?.length ? raw.items : null) || 
                             (raw.OrderItems?.length ? raw.OrderItems : null) || 
                             (raw.Items?.length ? raw.Items : null) || 
                             (o.items?.length ? o.items : []);
                             
  const rawItems = Array.isArray(itemsListCandidate) ? itemsListCandidate : [];

  // 2. Fallback: Se o pedido tem unidades mas zero itens no payload, gera um placeholder
  if (rawItems.length === 0 && (o.num_items_shipped > 0 || o.num_items_unshipped > 0)) {
    return [{
       sku:       'Sincronizando...',
       asin:      '...',
       title:     'Sincronizando produtos...',
       quantity:  o.num_items_shipped || o.num_items_unshipped || 1,
       price:     (o.total || 0) / (o.num_items_shipped || 1),
    }];
  }

  // 3. Normalização Universal de cada Item
  return rawItems.map((i: any) => {
    const asinVal = i.asin || i.ASIN || '...';
    const skuVal  = i.sku  || i.SellerSKU || '...';
    
    // Título: prioridade máxima para o catálogo local (estável) vs Payload Amazon (volátil)
    const invTitle = inventory.find(inv => inv.asin === asinVal || inv.sku === skuVal)?.title;
    const titleVal = invTitle || i.title || i.Title || `Item ${asinVal}`;

    return {
      sku:       skuVal,
      asin:      asinVal,
      title:     titleVal,
      quantity:  i.quantity || i.QuantityOrdered || 0,
      price:     i.price || i.ItemPrice?.Amount ? parseFloat(i.ItemPrice?.Amount || i.price) : 0,
      image_url: i.image_url
    };
  });
}

export function calculateOrderTotal(o: any, items: any[], inventory: InventoryRow[] = [], livePrices: Map<string, { price?: number; error?: string }> = new Map()): number {
  if (o.total && o.total > 0) return o.total;

  return items.reduce((sum, i) => {
    const asinVal = i.asin || i.ASIN;
    const skuVal  = i.sku  || i.SellerSKU;
    const qtyVal  = i.quantity || i.QuantityOrdered || 0;
    const priceVal = i.price || i.ItemPrice?.Amount || 0;
    
    if (priceVal > 0) return sum + (priceVal * qtyVal);

    const liveResult = asinVal ? livePrices.get(asinVal) : null;
    const livePrice = liveResult?.price;
    if (livePrice) return sum + (livePrice * qtyVal);

    const invItem = inventory.find(inv => inv.asin === asinVal || inv.sku === skuVal);
    return sum + ((invItem?.avg_price || 0) * qtyVal);
  }, 0);
}

export async function getDashboardSummary(range: string = '30d', from?: string, to?: string) {
  const now = new Date();
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  if (marketplaceId) {
    checkAndTriggerNewOrdersSync(marketplaceId);
    checkAndTriggerStatusSync(marketplaceId);
  }
  
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  let startDate = new Date();
  let endDate: Date | undefined = undefined;
  let label = '30 Dias';

  switch (range) {
    case 'today': startDate = todayStart; label = 'Hoje'; break;
    case 'yesterday': 
      startDate = new Date(todayStart); startDate.setDate(todayStart.getDate() - 1);
      endDate = new Date(todayStart); endDate.setMilliseconds(-1);
      label = 'Ontem'; break;
    case '7d': startDate = new Date(todayStart); startDate.setDate(todayStart.getDate() - 7); label = '7 Dias'; break;
    default: startDate = new Date(todayStart); startDate.setDate(todayStart.getDate() - 30);
  }

  try {
    const orders = await queryOrdersFromDB(marketplaceId!, startDate, endDate);
    const inventory = await getInventory();
    const allAsins = Array.from(new Set(inventory.map(i => i.asin)));
    const livePrices = await fetchLivePrices(allAsins);

    const orderStats = orders.filter(o => o.status !== 'canceled').map(o => {
      const raw = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
      const items = extractNormalizedItems(o, raw, inventory);
      const total = calculateOrderTotal(o, items, inventory, livePrices);
      const units = items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
      return { ...o, total, units, items };
    });

    const totalOrders = orderStats.length;
    const totalSales = orderStats.reduce((acc, o) => acc + o.total, 0);
    const totalUnits = orderStats.reduce((acc, o) => acc + o.units, 0);

    const dailyMap = new Map<string, { sales: number; orders: number; units: number }>();
    if (range === 'today' || range === 'yesterday') {
      for (let h = 0; h < 24; h++) dailyMap.set(`${h.toString().padStart(2, '0')}h`, { sales: 0, orders: 0, units: 0 });
    } else {
      const current = new Date(startDate);
      const limit = endDate || now;
      while (current <= limit) {
        dailyMap.set(current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), { sales: 0, orders: 0, units: 0 });
        current.setDate(current.getDate() + 1);
      }
    }

    orderStats.forEach(o => {
      const d = new Date(o.created_at);
      const key = (range === 'today' || range === 'yesterday') ? `${d.getHours().toString().padStart(2, '0')}h` : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const stats = dailyMap.get(key);
      if (stats) { stats.sales += o.total; stats.orders += 1; stats.units += o.units; }
    });

    return {
      vendas_hoje: totalSales, pedidos_hoje: totalOrders, unidades_vendidas: totalUnits,
      ticket_medio: totalUnits > 0 ? totalSales / totalUnits : 0,
      estoque_valorizado: inventory.reduce((acc, i) => acc + (i.available * i.unit_cost), 0),
      skus_ativos: inventory.filter(i => i.available > 0).length,
      chartData: Array.from(dailyMap.entries()).map(([label, stats]) => ({ label, ...stats })),
      rangeLabel: label,
      diagnostics: { supabase: true, amazon: true, marketplace: true }
    };
  } catch (error) { return { chartData: [], rangeLabel: 'Erro', diagnostics: { error: String(error) } }; }
}

export async function getInventory(): Promise<InventoryRow[]> {
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  if (!marketplaceId) return [];
  const amz = getAmazonClient();
  let summaries: any[] = [];
  if (amz) {
    try {
      const resp = await amz.callAPI({
        operation: 'getInventorySummaries', endpoint: 'fbaInventory',
        query: { granularityType: 'Marketplace', granularityId: marketplaceId, marketplaceIds: [marketplaceId], details: true }
      });
      summaries = resp.payload?.inventorySummaries || resp.inventorySummaries || [];
    } catch (err) { console.error("[Inventory] Erro:", err); }
  }

  const window30 = new Date(); window30.setDate(window30.getDate() - 30);
  const orders30d = await queryOrdersFromDB(marketplaceId, window30);
  const salesByAsin = new Map<string, { units: number; total: number; firstSale: string }>();
  
  orders30d.forEach(o => {
    if (o.status === 'canceled') return;
    const raw = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
    const items = extractNormalizedItems(o, raw);
    items.forEach((i: any) => {
      const asin = i.asin || 'NONE';
      const current = salesByAsin.get(asin) || { units: 0, total: 0, firstSale: o.created_at };
      salesByAsin.set(asin, { units: current.units + i.quantity, total: current.total + (i.price * i.quantity), firstSale: current.firstSale });
    });
  });

  const allAsins = Array.from(new Set([...summaries.map(s => s.asin), ...salesByAsin.keys()]));
  const metaList = await getProductsMeta(allAsins);
  const metaMap = new Map(metaList.map(m => [m.asin, m]));

  return summaries.map((item: any) => {
    const meta = metaMap.get(item.asin);
    const units_30d = salesByAsin.get(item.asin)?.units || 0;
    const available = item.inventoryDetails?.fulfillableQuantity ?? item.totalQuantity ?? 0;
    return {
      asin: item.asin, sku: item.sellerSku || meta?.sku || '...',
      title: meta?.title || item.productName || `Produto ${item.sellerSku}`,
      available, in_transit: item.inventoryDetails?.inboundReceivingQuantity || 0,
      sales_velocity: units_30d / 30, units_30d, 
      unit_cost: meta?.unit_cost || 0, total_cost: available * (meta?.unit_cost || 0),
      avg_price: units_30d > 0 ? (salesByAsin.get(item.asin)!.total / units_30d) : 0,
      status: available > 0 ? 'active' : 'out_of_stock', risk_level: 'healthy',
      last_updated: item.lastUpdatedTime
    } as any;
  });
}

export async function getOrders(daysAgo: number): Promise<Order[]> {
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  if (!marketplaceId) return [];
  const startDate = new Date(); startDate.setDate(startDate.getDate() - daysAgo);
  
  try {
    const [ordersRaw, inventory] = await Promise.all([queryOrdersFromDB(marketplaceId, startDate), getInventory()]);
    const allAsins = Array.from(new Set(inventory.map(i => i.asin)));
    const livePrices = await fetchLivePrices(allAsins);

    return ordersRaw.map((o: any): Order => {
      const raw = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
      const items = extractNormalizedItems(o, raw, inventory);
      return {
        id: o.id, amazon_order_id: o.amazon_order_id, created_at: o.created_at,
        status: o.status as any, fulfillment_channel: (o.fulfillment_channel || 'FBA') as any,
        total: calculateOrderTotal(o, items, inventory, livePrices),
        items
      };
    });
  } catch (error) { return []; }
}

export async function getPricing() {
  const inventory = await getInventory();
  return inventory.map(row => ({
    sku: row.sku, asin: row.asin, title: row.title,
    current_price: row.avg_price, status: 'optimized', margin_percentage: 20
  })) as any;
}

export async function syncPendingOrders(marketplaceId: string) {
  const pendingRows = await getPendingOrdersFromDB(marketplaceId);
  const amz = getAmazonClient();
  if (!amz || !pendingRows.length) return;

  for (const row of pendingRows) {
    try {
      const resp = await amz.callAPI({ operation: 'getOrderItems', endpoint: 'orders', path: { orderId: row.id } });
      const items = resp.payload?.OrderItems || resp.OrderItems || [];
      if (items.length > 0) {
        // Encontra o total (muitas vezes vem 0 em pendentes, então usamos os itens)
        const orderResp = await amz.callAPI({ operation: 'getOrder', endpoint: 'orders', path: { orderId: row.id } });
        const o = orderResp.payload || orderResp;
        await upsertOrders([{ ...row, raw_payload: { ...o, items }, status: o.OrderStatus, total: parseFloat(o.OrderTotal?.Amount || '0') }]);
      }
    } catch (e) {}
  }
}

async function checkAndTriggerNewOrdersSync(mId: string) {}
async function checkAndTriggerStatusSync(mId: string) {}
export async function getAlerts() { return []; }
export async function fetchOrderItems(ids: string[]) { return {}; }
