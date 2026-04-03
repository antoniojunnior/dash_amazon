/**
 * orders-repository.ts
 *
 * Camada de persistência Supabase para pedidos Amazon. 
 * Nomes de tabelas e colunas alinhados com o schema real do PostgreSQL.
 */

import { createClient } from '@supabase/supabase-js';

// Usamos service_role para writes server-side (ignora RLS)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    if (process.env.NODE_ENV === 'development' || true) {
       console.error(`[Supabase] Erro Crítico: Credenciais ausentes.`);
    }
    const dummyClient = {
      from: () => ({
        select: () => ({
          eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }), maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
          in: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
          maybeSingle: () => Promise.resolve({ data: null, error: null })
        }),
        insert: () => Promise.resolve({ error: null }),
        upsert: () => Promise.resolve({ error: null })
      })
    };
    return dummyClient as any;
  }
  return createClient(url, key);
}

export interface OrderRow {
  id:                  string;
  amazon_order_id:     string;
  marketplace_id:      string;
  created_at:          string; 
  status:              string;
  fulfillment_channel: string;
  total:               number;
  currency:            string;
  num_items_shipped:   number;
  num_items_unshipped: number;
  raw_payload?:        any;
}

/**
 * Mapeia um pedido processado para o schema real da tabela amazon_orders.
 * CORREÇÃO: Evita aninhamento recursivo de raw_payload ao espalhar apenas o objeto de dados puro.
 */
export function toOrderRow(o: any, marketplaceId: string): any {
  const idValue = o.id || o.amazon_order_id || o.AmazonOrderId;
  
  // Limpeza de Payload: Se 'o' for uma linha do banco, pegamos o payload real de dentro
  const nestedPayload = o.raw_payload;
  const source = (nestedPayload && typeof nestedPayload === 'object' && !Array.isArray(nestedPayload)) ? nestedPayload : o;

  // Busca de Itens (multi-nível para resiliência)
  const itemsSource = (source.items?.length ? source.items : 
                      (source.raw_payload?.items?.length ? source.raw_payload.items : 
                      (source.raw_payload?.OrderItems?.length ? source.raw_payload.OrderItems : 
                      (source.OrderItems?.length ? source.OrderItems : []))));

  return {
    id:                  idValue,
    amazon_order_id:     idValue,
    marketplace_id:      marketplaceId,
    created_at:          o.created_at || o.PurchaseDate || source.created_at,
    status:              o.status || o.OrderStatus || source.status,
    fulfillment_channel: o.fulfillment_channel || (o.FulfillmentChannel === 'AFN' ? 'FBA' : 'FBM') || source.fulfillment_channel || 'FBA',
    total:               o.total || (o.OrderTotal?.Amount ? parseFloat(o.OrderTotal.Amount) : 0) || source.total || 0,
    currency:            o.currency || o.OrderTotal?.CurrencyCode || source.currency || 'BRL',
    num_items_shipped:   o.num_items_shipped ?? o.NumberOfItemsShipped ?? (itemsSource[0]?.quantity || 0),
    num_items_unshipped: o.num_items_unshipped ?? o.NumberOfItemsUnshipped ?? 0,
    raw_payload: { ...source, items: itemsSource }, // Salva apenas o objeto de dados limpo
    updated_at: new Date().toISOString()
  };
}

export async function getLastSyncTime(marketplaceId: string): Promise<Date | null> {
  const db = getServiceClient();
  const { data, error } = await db.from('amazon_sync_log').select('synced_at').eq('marketplace_id', marketplaceId).order('synced_at', { ascending: false }).limit(1).maybeSingle();
  return (error || !data) ? null : new Date(data.synced_at);
}

export async function queryOrdersFromDB(marketplaceId: string, createdAfter: Date, createdBefore?: Date): Promise<OrderRow[]> {
  const db = getServiceClient();
  let query = db.from('amazon_orders').select('*').eq('marketplace_id', marketplaceId).gte('created_at', createdAfter.toISOString());
  if (createdBefore) query = query.lte('created_at', createdBefore.toISOString());
  const { data } = await query.order('created_at', { ascending: false });
  return (data || []) as OrderRow[];
}

export async function getProductsMeta(asins: string[]): Promise<any[]> {
  if (asins.length === 0) return [];
  const db = getServiceClient();
  const { data } = await db.from('amazon_product_meta').select('*').in('asin', asins);
  return data || [];
}

export async function upsertProductMeta(meta: any): Promise<void> {
  const db = getServiceClient();
  await db.from('amazon_product_meta').upsert({ ...meta, last_updated: new Date().toISOString() }, { onConflict: 'asin' });
}

export async function upsertOrders(orders: any[]): Promise<number> {
  if (orders.length === 0) return 0;
  const db = getServiceClient();
  await db.from('amazon_orders').upsert(orders, { onConflict: 'id' });
  return orders.length;
}

export async function recordSync(marketplaceId: string, stats: any): Promise<void> {
  const db = getServiceClient();
  await db.from('amazon_sync_log').insert({ marketplace_id: marketplaceId, synced_at: new Date().toISOString(), ...stats });
}

export async function getPendingOrdersFromDB(marketplaceId: string): Promise<OrderRow[]> {
  const db = getServiceClient();
  const fifteenDaysAgo = new Date(); fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  const { data } = await db.from('amazon_orders').select('*').eq('marketplace_id', marketplaceId).in('status', ['Pending', 'PaymentPending', 'PartiallyShipped', 'Unshipped']).gte('created_at', fifteenDaysAgo.toISOString());
  return (data || []) as OrderRow[];
}
