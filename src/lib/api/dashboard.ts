import { getAmazonClient } from '../amazon/client';
import { getProductsMeta, queryOrdersFromDB, getPendingOrdersFromDB, recordSync, upsertOrders, toOrderRow } from '../supabase/orders-repository';
import { InventoryRow, Order, OrderItem, Alert, PricingRow, DashboardSummary, ChartDataPoint } from '@/types';

// Cache global simples
let globalCache: {
  summary?: { data: any; timestamp: number };
  inventory?: { data: InventoryRow[]; timestamp: number };
  livePrices?: { data: Map<string, number>; timestamp: number };
} = {};

const LIVE_PRICES_CACHE_TTL = 2 * 60 * 1000;

function isCacheFresh(timestamp?: number) {
  return timestamp ? (Date.now() - timestamp < LIVE_PRICES_CACHE_TTL) : false;
}

export async function fetchLivePrices(asins: string[]): Promise<Map<string, { price?: number; error?: string }>> {
  if (!asins.length) return new Map();
  const liveResults = new Map<string, { price?: number; error?: string }>();
  if (isCacheFresh(globalCache.livePrices?.timestamp)) return globalCache.livePrices!.data as any;

  const amz = getAmazonClient();
  if (!amz) return liveResults;
  const mId = process.env.AMAZON_MARKETPLACE_ID;
  if (!mId) return liveResults;

  for (let i = 0; i < asins.length; i += 20) {
    const batch = asins.slice(i, i + 20);
    try {
      const results = await Promise.all(batch.map(async (asin) => {
        try {
          const resp = await amz.callAPI({ 
            operation: 'getPricing', endpoint: 'productPricing', 
            query: { MarketplaceId: mId, ItemType: 'Asin', Asins: [asin] } 
          });
          const p = (resp.payload || resp).Product || (Array.isArray(resp) ? resp[0]?.Product : null);
          const price = p?.Offers?.[0]?.BuyingPrice?.ListingPrice?.Amount || p?.Offers?.[0]?.RegularPrice?.Amount;
          return price ? { asin, price: parseFloat(price) } : { asin, error: 'Sem preço' };
        } catch (e) { return { asin, error: 'Erro' }; }
      }));
      results.forEach(r => { if (r?.asin) liveResults.set(r.asin, { price: r.price, error: r.error }); });
    } catch (e) {}
  }
  globalCache.livePrices = { data: liveResults as any, timestamp: Date.now() };
  return liveResults;
}

export function calculateOrderTotal(o: any, items: any[], inventory: InventoryRow[] = [], livePrices: Map<string, { price?: number; error?: string }> = new Map()): number {
  if (o.total && o.total > 0) return o.total;
  return items.reduce((sum, i) => {
    const asinVal = i.asin || i.ASIN;
    const qtyVal  = i.quantity || 0;
    const priceVal = i.price || 0;
    if (priceVal > 0) return sum + (priceVal * qtyVal);
    const livePrice = asinVal ? livePrices.get(asinVal)?.price : null;
    if (livePrice) return sum + (livePrice * qtyVal);
    const invItem = inventory.find(inv => inv.asin === asinVal || inv.sku === i.sku);
    return sum + ((invItem?.unit_cost || 0) * 1.5 * qtyVal);
  }, 0);
}

export function extractNormalizedItems(o: any, raw: any, inventory: InventoryRow[] = []): OrderItem[] {
  let rawList: any = null;
  const findItems = (data: any): any[] | null => {
    if (!data || typeof data !== 'object') return null;
    const keys = Object.keys(data);
    const kItems = keys.find(k => k.toLowerCase() === 'items');
    if (kItems && Array.isArray(data[kItems]) && data[kItems].length > 0) return data[kItems];
    const kOrderItems = keys.find(k => k.toLowerCase() === 'orderitems');
    if (kOrderItems) {
      const nested = data[kOrderItems]?.OrderItem || data[kOrderItems];
      if (Array.isArray(nested) && nested.length > 0) return nested;
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) return [nested];
    }
    if (data.raw_payload && typeof data.raw_payload === 'object') return findItems(data.raw_payload);
    if (data.payload && typeof data.payload === 'object') return findItems(data.payload);
    return null;
  };
  rawList = findItems(raw);
  if (!rawList && o.items && Array.isArray(o.items) && o.items.length > 0) rawList = o.items;
  let items = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);
  if (items.length === 0) {
    return [{
       sku: '...', asin: '...', title: 'Sincronizando produtos da Amazon...',
       quantity: 1, price: 0
    }];
  }
  return items.map((i: any) => {
    const asin = i.asin || i.ASIN || '...';
    const sku = i.sku || i.SellerSKU || '...';
    const meta = inventory.find(inv => inv.asin === asin || inv.sku === sku);
    let title = i.title || i.Title || i.productName || '';
    if (!title || title.includes('Pedido ') || title.includes('Sincronizando')) {
       title = meta?.title || title || `Item: ${asin}`;
    }
    return { sku, asin, title, quantity: i.quantity || i.QuantityOrdered || 0, price: parseFloat(i.price || i.ItemPrice?.Amount || '0') };
  });
}

export async function getDashboardSummary(range: string = '30d', from?: string, to?: string): Promise<DashboardSummary> {
  const mId = process.env.AMAZON_MARKETPLACE_ID;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let start = new Date();
  const isTimeRange = range === 'today' || range === 'yesterday';

  if (range === 'today') start = today;
  else if (range === 'yesterday') { start = new Date(today); start.setDate(today.getDate() - 1); }
  else if (from) start = new Date(from);
  else start.setDate(today.getDate() - 30);

  try {
    const [orders, inventory] = await Promise.all([queryOrdersFromDB(mId!, start), getInventory()]);
    const live = await fetchLivePrices(Array.from(new Set(inventory.map(i => i.asin))));
    
    const stats = orders.filter(o => o.status !== 'canceled').map(o => {
      const raw = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
      const items = extractNormalizedItems(o, raw, inventory);
      const total = o.total || calculateOrderTotal(o, items, inventory, live);
      const units = items.reduce((a, b) => a + b.quantity, 0);
      return { ...o, total, units };
    });

    // CÁLCULO DO CHART DATA (SÉRIE TEMPORAL)
    const chartMap = new Map<string, ChartDataPoint>();
    stats.forEach(o => {
      const date = new Date(o.created_at);
      const label = isTimeRange ? `${date.getHours()}h` : `${date.getDate()}/${date.getMonth() + 1}`;
      const bucket = chartMap.get(label) || { label, sales: 0, orders: 0, units: 0 };
      bucket.sales += o.total;
      bucket.orders += 1;
      bucket.units += o.units;
      chartMap.set(label, bucket);
    });

    const chartData = Array.from(chartMap.values()).sort((a,b) => {
        if (isTimeRange) return parseInt(a.label) - parseInt(b.label);
        const [da, ma] = a.label.split('/').map(Number);
        const [db, mb] = b.label.split('/').map(Number);
        return (ma === mb) ? da - db : ma - mb;
    });

    const sales = stats.reduce((a, b) => a + b.total, 0);
    const units = stats.reduce((a, b) => a + b.units, 0);

    return { 
      vendas_hoje: sales, vendas_hoje_var: 0,
      pedidos_hoje: stats.length, pedidos_hoje_var: 0,
      unidades_vendidas: units, 
      ticket_medio: units > 0 ? sales / units : 0, ticket_medio_var: 0,
      estoque_valorizado: inventory.reduce((a, b) => a + (b.available * b.unit_cost), 0), 
      skus_ativos: inventory.length, // Agora InventoryRow já vem agregado por ASIN
      acos_medio: 0, acos_medio_var: 0, 
      buybox_win: 0,
      chartData, rangeLabel: range,
      diagnostics: { supabase: true, amazon: true, marketplace: true }
    } as DashboardSummary;
  } catch (e) { return { chartData: [], rangeLabel: 'Erro', diagnostics: { supabase: false, amazon: false, marketplace: false } } as any; }
}

export async function getInventory(): Promise<InventoryRow[]> {
  const mId = process.env.AMAZON_MARKETPLACE_ID;
  const amz = getAmazonClient();
  if (!amz || !mId) return [];
  try {
    const resp = await amz.callAPI({ 
        operation: 'getInventorySummaries', 
        endpoint: 'fbaInventory', 
        query: { granularityType: 'Marketplace', granularityId: mId, marketplaceIds: [mId], details: true } 
    });
    const sums = resp.payload?.inventorySummaries || resp.inventorySummaries || [];
    
    // AGREGAÇÃO POR ASIN: Unifica múltiplos SKUs sob o mesmo produto
    const aggMap = new Map<string, any>();
    sums.forEach((s: any) => {
      const prev = aggMap.get(s.asin);
      const av = s.inventoryDetails?.fulfillableQuantity ?? s.totalQuantity ?? 0;
      if (prev) {
        prev.available += av;
        if (!prev.sku && s.sellerSku) prev.sku = s.sellerSku;
      } else {
        aggMap.set(s.asin, {
          asin: s.asin,
          sku: s.sellerSku,
          title: s.productName,
          available: av
        });
      }
    });

    const meta = await getProductsMeta(Array.from(aggMap.keys()));
    const mMap = new Map(meta.map(m => [m.asin, m]));

    return Array.from(aggMap.values()).map(s => {
      const m = mMap.get(s.asin);
      const finalTitle = m?.title || s.title || `ASIN: ${s.asin}`;
      return { 
        asin: s.asin, 
        sku: s.sku || m?.sku || '...', 
        title: finalTitle, 
        available: s.available, 
        unit_cost: m?.unit_cost || 0, 
        status: s.available > 0 ? 'active' : 'out_of_stock' 
      } as any;
    });
  } catch (e) { return []; }
}

export async function getOrders(daysAgo: number): Promise<Order[]> {
  const mId = process.env.AMAZON_MARKETPLACE_ID;
  const start = new Date(); start.setDate(start.getDate() - daysAgo);
  try {
    const [raw, inv] = await Promise.all([queryOrdersFromDB(mId!, start), getInventory()]);
    return raw.map((o: any): Order => {
       const payload = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
       const items = extractNormalizedItems(o, payload, inv);
       return { id: o.id, amazon_order_id: o.amazon_order_id, created_at: o.created_at, status: o.status as any, fulfillment_channel: (o.fulfillment_channel || 'FBA') as any, total: o.total || calculateOrderTotal(o, items, inv, new Map()), items };
    });
  } catch (e) { return []; }
}

export async function syncNewOrders(marketplaceId: string) {
  const amz = getAmazonClient();
  if (!amz) return;
  const createdAfter = new Date(); createdAfter.setHours(createdAfter.getHours() - 36);
  try {
    const resp = await amz.callAPI({ operation: 'getOrders', endpoint: 'orders', query: { MarketplaceIds: [marketplaceId], CreatedAfter: createdAfter.toISOString() } });
    const orders = resp.payload?.Orders || resp.Orders || [];
    const rows = orders.map((o: any) => toOrderRow(o, marketplaceId));
    await upsertOrders(rows);
    return rows.length;
  } catch (e) { console.error('[Sync] Erro:', e); }
}

export async function fetchOrderItems(orderIds: string[]) {
  const amz = getAmazonClient();
  if (!amz) return {};
  const results: Record<string, any[]> = {};
  for (const id of orderIds) {
    try {
      const resp = await amz.callAPI({ operation: 'getOrderItems', endpoint: 'orders', path: { orderId: id } });
      const items = resp.payload?.OrderItems || resp.OrderItems || [];
      results[id] = Array.isArray(items) ? items : (items.OrderItem ? (Array.isArray(items.OrderItem) ? items.OrderItem : [items.OrderItem]) : [items]);
      await new Promise(r => setTimeout(r, 500));
    } catch (e) { results[id] = []; }
  }
  return results;
}

export async function syncPendingOrders(marketplaceId: string) {
  const pending = await getPendingOrdersFromDB(marketplaceId);
  if (pending.length === 0) return;
  const amz = getAmazonClient();
  if (!amz) return;
  for (const p of pending) {
    try {
      const resp = await amz.callAPI({ operation: 'getOrder', endpoint: 'orders', path: { orderId: p.amazon_order_id } });
      const o = resp.payload || resp;
      await upsertOrders([toOrderRow(o, marketplaceId)]);
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {}
  }
}

export async function getAlerts(): Promise<Alert[]> { return []; }
export async function getPricing(): Promise<PricingRow[]> { return []; }
export async function checkAndTriggerNewOrdersSync(m: string) {}
export async function checkAndTriggerStatusSync(m: string) {}
