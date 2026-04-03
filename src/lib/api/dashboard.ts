import { getAmazonClient } from '../amazon/client';
import { getProductsMeta, queryOrdersFromDB, getPendingOrdersFromDB, recordSync, upsertOrders, toOrderRow } from '../supabase/orders-repository';
import { InventoryRow, Order, OrderItem } from '@/types';

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

/**
 * Cálculo de total do pedido com inteligência de fallback.
 */
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
    return sum + ((invItem?.unit_cost || 0) * 1.5 * qtyVal); // Fallback estimado
  }, 0);
}

/**
 * Extração de itens com robustez máxima.
 */
export function extractNormalizedItems(o: any, raw: any, inventory: InventoryRow[] = []): OrderItem[] {
  let rawList: any = null;
  const keys = Object.keys(raw || {});
  const findK = (t: string) => keys.find(k => k.toLowerCase() === t.toLowerCase());

  const kItems = findK('items');
  const kOrderItems = findK('OrderItems');

  if (kItems && Array.isArray(raw[kItems]) && raw[kItems].length > 0) rawList = raw[kItems];
  else if (kOrderItems) {
    const nested = raw[kOrderItems]?.OrderItem || raw[kOrderItems];
    if (Array.isArray(nested) && nested.length > 0) rawList = nested;
    else if (nested && typeof nested === 'object' && !Array.isArray(nested)) rawList = [nested];
  }
  
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
    let title = i.title || i.Title || '';
    if (!title || title.includes('Pedido ') || title.includes('Sincronizando')) {
       title = meta?.title || title || `Item: ${asin}`;
    }
    return { 
      sku, asin, title, 
      quantity: i.quantity || i.QuantityOrdered || 0, 
      price: parseFloat(i.price || i.ItemPrice?.Amount || '0') 
    };
  });
}

export async function getDashboardSummary(range: string = '30d') {
  const mId = process.env.AMAZON_MARKETPLACE_ID;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let start = new Date();
  if (range === 'today') start = today;
  else if (range === 'yesterday') { start = new Date(today); start.setDate(today.getDate() - 1); }
  else start.setDate(today.getDate() - 30);

  try {
    const [orders, inventory] = await Promise.all([queryOrdersFromDB(mId!, start), getInventory()]);
    const live = await fetchLivePrices(Array.from(new Set(inventory.map(i => i.asin))));
    const stats = orders.filter(o => o.status !== 'canceled').map(o => {
      const raw = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
      const items = extractNormalizedItems(o, raw, inventory);
      return { ...o, total: o.total || calculateOrderTotal(o, items, inventory, live), units: items.reduce((a, b) => a + b.quantity, 0) };
    });
    const sales = stats.reduce((a, b) => a + b.total, 0);
    const units = stats.reduce((a, b) => a + b.units, 0);
    return { vendas_hoje: sales, pedidos_hoje: stats.length, unidades_vendidas: units, ticket_medio: units > 0 ? sales / units : 0, estoque_valorizado: inventory.reduce((a, b) => a + (b.available * b.unit_cost), 0), skus_ativos: inventory.length, chartData: [], rangeLabel: range, diagnostics: {} };
  } catch (e) { return { chartData: [], rangeLabel: 'Erro' }; }
}

export async function getInventory(): Promise<InventoryRow[]> {
  const mId = process.env.AMAZON_MARKETPLACE_ID;
  const amz = getAmazonClient();
  if (!amz || !mId) return [];
  try {
    const resp = await amz.callAPI({ operation: 'getInventorySummaries', endpoint: 'fbaInventory', query: { granularityType: 'Marketplace', granularityId: mId, marketplaceIds: [mId], details: true } });
    const sums = resp.payload?.inventorySummaries || resp.inventorySummaries || [];
    const meta = await getProductsMeta(Array.from(new Set(sums.map((s: any) => s.asin))));
    const mMap = new Map(meta.map(m => [m.asin, m]));
    return sums.map((s: any) => {
      const m = mMap.get(s.asin);
      const av = s.inventoryDetails?.fulfillableQuantity ?? s.totalQuantity ?? 0;
      return { asin: s.asin, sku: s.sellerSku || m?.sku || '...', title: m?.title || s.productName || `ASIN: ${s.asin}`, available: av, unit_cost: m?.unit_cost || 0, status: av > 0 ? 'active' : 'out_of_stock' } as any;
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

/**
 * SINCRONIZAÇÃO DE NOVOS PEDIDOS (Utilizado pelo Cron)
 */
export async function syncNewOrders(marketplaceId: string) {
  const amz = getAmazonClient();
  if (!amz) return;
  const createdAfter = new Date();
  createdAfter.setHours(createdAfter.getHours() - 36); // Janela de segurança de 36h

  try {
    const resp = await amz.callAPI({ 
      operation: 'getOrders', endpoint: 'orders', 
      query: { MarketplaceIds: [marketplaceId], CreatedAfter: createdAfter.toISOString() } 
    });
    const orders = resp.payload?.Orders || resp.Orders || [];
    const rows = orders.map((o: any) => toOrderRow(o, marketplaceId));
    await upsertOrders(rows);
    return rows.length;
  } catch (e) { console.error('[Sync] Erro ao sincronizar novos pedidos:', e); }
}

/**
 * BUSCA ITENS DA AMAZON (Utilizado pela Rota de Reparo)
 */
export async function fetchOrderItems(orderIds: string[]) {
  const amz = getAmazonClient();
  if (!amz) return {};
  const results: Record<string, any[]> = {};

  for (const id of orderIds) {
    try {
      const resp = await amz.callAPI({ operation: 'getOrderItems', endpoint: 'orders', path: { orderId: id } });
      const items = resp.payload?.OrderItems || resp.OrderItems || [];
      results[id] = Array.isArray(items) ? items : (items.OrderItem ? (Array.isArray(items.OrderItem) ? items.OrderItem : [items.OrderItem]) : [items]);
      // Delay de cortesia para a API
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

export async function getAlerts() { return []; }
export async function getPricing() { return []; }
export async function checkAndTriggerNewOrdersSync(m: string) {}
export async function checkAndTriggerStatusSync(m: string) {}
