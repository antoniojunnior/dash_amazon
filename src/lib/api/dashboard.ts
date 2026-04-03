import { getAmazonClient } from '../amazon/client';
import { getProductsMeta, queryOrdersFromDB, getPendingOrdersFromDB, recordSync, upsertOrders } from '../supabase/orders-repository';
import { InventoryRow, Order, OrderItem } from '@/types';

// Cache global simples para o sumário do dashboard e preços live
let globalCache: {
  summary?: { data: any; timestamp: number };
  inventory?: { data: InventoryRow[]; timestamp: number };
  livePrices?: { data: Map<string, number>; timestamp: number };
} = {};

const LIVE_PRICES_CACHE_TTL = 2 * 60 * 1000;

function isCacheFresh(timestamp?: number) {
  if (!timestamp) return false;
  return Date.now() - timestamp < LIVE_PRICES_CACHE_TTL;
}

/**
 * Busca os preços atuais de uma lista de ASINs via SP-API (Product Pricing).
 */
export async function fetchLivePrices(asins: string[]): Promise<Map<string, { price?: number; error?: string }>> {
  if (!asins.length) return new Map();
  const liveResults = new Map<string, { price?: number; error?: string }>();
  if (isCacheFresh(globalCache.livePrices?.timestamp)) return globalCache.livePrices!.data as any;

  const amz = getAmazonClient();
  if (!amz) return liveResults;
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  if (!marketplaceId) return liveResults;
  
  for (let i = 0; i < asins.length; i += 20) {
    const batch = asins.slice(i, i + 20);
    try {
      const results = await Promise.all(batch.map(async (asin) => {
        if (!asin || asin === 'NONE' || asin === '...') return { asin, error: 'Inválido' };
        try {
          const resp = await amz.callAPI({
            operation: 'getPricing', endpoint: 'productPricing',
            query: { MarketplaceId: marketplaceId, ItemType: 'Asin', Asins: [asin] }
          });
          const payload = resp.payload || resp;
          const product = payload.Product || (Array.isArray(payload) ? payload[0]?.Product : null);
          let price = product?.Offers?.[0]?.BuyingPrice?.ListingPrice?.Amount || product?.Offers?.[0]?.RegularPrice?.Amount;
          return price ? { asin, price: parseFloat(price) } : { asin, error: 'Sem preço' };
        } catch (err: any) { return { asin, error: 'Erro API' }; }
      }));
      results.forEach(res => { if (res) liveResults.set(res.asin, { price: res.price, error: res.error }); });
    } catch (err) {}
  }
  globalCache.livePrices = { data: liveResults as any, timestamp: Date.now() };
  return liveResults;
}

/**
 * Helper unificado para extração PROFUNDA de itens de um pedido com PLACEHOLDER UNIVERSAL.
 */
export function extractNormalizedItems(o: any, raw: any, inventory: InventoryRow[] = []): OrderItem[] {
  let rawList: any = null;
  
  // Tenta normalizar as chaves para ignorar diferenças de minúsculas/maiúsculas
  const keys = Object.keys(raw);
  const findKey = (term: string) => keys.find(k => k.toLowerCase() === term.toLowerCase());

  // Busca em todas as chaves possíveis
  const itemsKey = findKey('items');
  const orderItemsKey = findKey('OrderItems');
  const orderitemsKey = findKey('orderitems');

  if (itemsKey && Array.isArray(raw[itemsKey]) && raw[itemsKey].length > 0) rawList = raw[itemsKey];
  else if (orderItemsKey) rawList = raw[orderItemsKey].OrderItem || raw[orderItemsKey];
  else if (orderitemsKey) rawList = raw[orderitemsKey].OrderItem || raw[orderitemsKey];
  else if (o.items && Array.isArray(o.items) && o.items.length > 0) rawList = o.items;

  // Garante que rawList seja um Array
  let items = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);

  // PLACEHOLDER UNIVERSAL: Se a lista estiver vazia, GARANTE pelo menos um item para não ficar em branco na tela.
  if (items.length === 0) {
    return [{
       sku:       '...',
       asin:      '...',
       title:     'Sincronizando produtos da Amazon...',
       quantity:  Math.max(o.num_items_shipped || 0, o.num_items_unshipped || 1, 1),
       price:     0
    }];
  }

  // Normalização e Reconstrução de Nomes
  return items.map((i: any) => {
    const asinVal = i.asin || i.ASIN || '...';
    const skuVal  = i.sku  || i.SellerSKU || '...';
    
    // Título: Prioridade catálogo local
    const metaCandidate = inventory.find(inv => inv.asin === asinVal || inv.sku === skuVal);
    let titleVal = i.title || i.Title || '';
    
    // Se o título for vazio ou genérico, tenta o inventário ou o ASIN
    if (!titleVal || titleVal.includes('Pedido ') || titleVal.includes('Sincronizando')) {
       titleVal = metaCandidate?.title || titleVal || `Item: ${asinVal !== '...' ? asinVal : 'Processando...'}`;
    }

    return {
      sku:       skuVal,
      asin:      asinVal,
      title:     titleVal,
      quantity:  i.quantity || i.QuantityOrdered || 0,
      price:     parseFloat(i.price || i.ItemPrice?.Amount || '0'),
      image_url: i.image_url
    };
  });
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
    return sum + ((invItem?.avg_price || 0) * qtyVal);
  }, 0);
}

export async function getDashboardSummary(range: string = '30d') {
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  let startDate = new Date(); let label = '30 Dias';

  switch (range) {
    case 'today': startDate = todayStart; label = 'Hoje'; break;
    case 'yesterday': startDate = new Date(todayStart); startDate.setDate(todayStart.getDate() - 1); label = 'Ontem'; break;
    default: startDate = new Date(todayStart); startDate.setDate(todayStart.getDate() - 30);
  }

  try {
    const [orders, inventory] = await Promise.all([queryOrdersFromDB(marketplaceId!, startDate), getInventory()]);
    const livePrices = await fetchLivePrices(Array.from(new Set(inventory.map(i => i.asin))));
    const orderStats = orders.filter(o => o.status !== 'canceled').map(o => {
      const raw = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
      const items = extractNormalizedItems(o, raw, inventory);
      return { ...o, total: calculateOrderTotal(o, items, inventory, livePrices), units: items.reduce((s, i) => s + i.quantity, 0) };
    });

    const totalSales = orderStats.reduce((a, b) => a + b.total, 0);
    const totalUnits = orderStats.reduce((a, b) => a + b.units, 0);

    return {
      vendas_hoje: totalSales, pedidos_hoje: orderStats.length, unidades_vendidas: totalUnits,
      ticket_medio: totalUnits > 0 ? totalSales / totalUnits : 0,
      estoque_valorizado: inventory.reduce((a, b) => a + (b.available * b.unit_cost), 0),
      chartData: [], rangeLabel: label, diagnostics: { supabase: true, amazon: true, marketplace: true }
    };
  } catch (e) { return { chartData: [], rangeLabel: 'Erro' }; }
}

export async function getInventory(): Promise<InventoryRow[]> {
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  const amz = getAmazonClient();
  if (!amz || !marketplaceId) return [];
  try {
    const resp = await amz.callAPI({ 
      operation: 'getInventorySummaries', endpoint: 'fbaInventory',
      query: { granularityType: 'Marketplace', granularityId: marketplaceId, marketplaceIds: [marketplaceId], details: true }
    });
    const summaries = resp.payload?.inventorySummaries || resp.inventorySummaries || [];
    const metaList = await getProductsMeta(Array.from(new Set(summaries.map((s: any) => s.asin))));
    const metaMap = new Map(metaList.map(m => [m.asin, m]));

    return summaries.map((item: any) => {
      const meta = metaMap.get(item.asin);
      const available = item.inventoryDetails?.fulfillableQuantity ?? item.totalQuantity ?? 0;
      return {
        asin: item.asin, sku: item.sellerSku || meta?.sku || '...',
        title: meta?.title || item.productName || `ASIN: ${item.asin}`,
        available, in_transit: item.inventoryDetails?.inboundReceivingQuantity || 0,
        unit_cost: meta?.unit_cost || 0, avg_price: 0, status: available > 0 ? 'active' : 'out_of_stock'
      } as any;
    });
  } catch (e) { return []; }
}

export async function getOrders(daysAgo: number): Promise<Order[]> {
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID;
  const startDate = new Date(); startDate.setDate(startDate.getDate() - daysAgo);
  try {
    const [ordersRaw, inventory] = await Promise.all([queryOrdersFromDB(marketplaceId!, startDate), getInventory()]);
    return ordersRaw.map((o: any): Order => {
       const raw = typeof o.raw_payload === 'string' ? JSON.parse(o.raw_payload) : (o.raw_payload || {});
       const items = extractNormalizedItems(o, raw, inventory);
       return {
         id: o.id, amazon_order_id: o.amazon_order_id, created_at: o.created_at,
         status: o.status as any, fulfillment_channel: (o.fulfillment_channel || 'FBA') as any,
         total: calculateOrderTotal(o, items, inventory, new Map()),
         items
       };
    });
  } catch (e) { return []; }
}

export async function getPricing() { return []; }
export async function getAlerts() { return []; }
export async function checkAndTriggerNewOrdersSync(m: string) {}
export async function checkAndTriggerStatusSync(m: string) {}
export async function fetchOrderItems(ids: string[]) { return {}; }
export async function syncPendingOrders(m: string) {}
