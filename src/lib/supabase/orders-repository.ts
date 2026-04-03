/**
 * orders-repository.ts
 *
 * Camada de persistência Supabase para pedidos Amazon. 
 * Nomes de tabelas e colunas alinhados com o schema real do PostgreSQL.
 */

import { createClient } from '@supabase/supabase-js';

// Usamos service_role para writes server-side (ignora RLS)
function getServiceClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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
  raw_payload?:        any; // Coluna JSONB real
}

const SYNC_TTL_SECONDS = 5 * 60;

/**
 * Mapeia um pedido processado para o schema real da tabela amazon_orders.
 * Importante: O schema real usa 'raw_payload' para dados flexíveis.
 */
export function toOrderRow(o: any, marketplaceId: string): any {
  // Garantimos que o ID seja consistente (Suporta PascalCase da Amazon e snake_case interno)
  const idValue = o.id || o.amazon_order_id || o.AmazonOrderId;
  
  if (!idValue) {
    console.warn('[Supabase] Tentativa de mapear pedido sem ID:', o);
  }

  return {
    id:                  idValue,
    amazon_order_id:     idValue,
    marketplace_id:      marketplaceId,
    created_at:          o.created_at,
    status:              o.status,
    fulfillment_channel: o.fulfillment_channel || 'FBA',
    total:               o.total || 0,
    currency:            'BRL',
    num_items_shipped:   o.num_items_shipped || (o.items?.[0]?.quantity || 0),
    num_items_unshipped: 0,
    // Guardamos o objeto completo (incluindo items mapeados) no raw_payload
    raw_payload:         o, 
    updated_at:          new Date().toISOString()
  };
}

export async function getLastSyncTime(marketplaceId: string): Promise<Date | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from('amazon_sync_log')
    .select('synced_at')
    .eq('marketplace_id', marketplaceId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return new Date(data.synced_at);
}

export function isCacheFresh(lastSync: Date | null): boolean {
  if (!lastSync) return false;
  const ageSeconds = (Date.now() - lastSync.getTime()) / 1000;
  return ageSeconds < SYNC_TTL_SECONDS;
}

export async function queryOrdersFromDB(
  marketplaceId: string,
  createdAfter: Date,
  createdBefore?: Date
): Promise<OrderRow[]> {
  const db = getServiceClient();

  let query = db
    .from('amazon_orders')
    .select('*')
    .eq('marketplace_id', marketplaceId)
    .gte('created_at', createdAfter.toISOString());
  
  if (createdBefore) {
    query = query.lte('created_at', createdBefore.toISOString());
  }

  const { data: orders, error: ordersError } = await query
    .order('created_at', { ascending: false });

  if (ordersError) {
    console.error('[Supabase] Erro na consulta de amazon_orders:', ordersError.message);
    throw ordersError;
  }

  return (orders || []) as OrderRow[];
}

export async function getProductsMeta(asins: string[]): Promise<any[]> {
  if (asins.length === 0) return [];
  const db = getServiceClient();
  const { data, error } = await db
    .from('amazon_product_meta')
    .select('*')
    .in('asin', asins);

  if (error) return [];
  return data || [];
}

export async function upsertProductMeta(meta: any): Promise<void> {
  const db = getServiceClient();
  await db
    .from('amazon_product_meta')
    .upsert({
      ...meta,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'asin' });
}

export async function upsertOrders(orders: any[]): Promise<number> {
  if (orders.length === 0) return 0;
  const db = getServiceClient();
  const { error } = await db.from('amazon_orders').upsert(orders, { onConflict: 'id' });
  if (error) {
    console.error('[Supabase] Erro ao salvar pedidos:', error.message);
    throw error;
  }
  return orders.length;
}

export async function recordSync(marketplaceId: string, stats: any): Promise<void> {
  const db = getServiceClient();
  // Incluímos synced_at explicitamente e espalhamos os stats
  await db.from('amazon_sync_log').insert({
    marketplace_id: marketplaceId,
    synced_at: new Date().toISOString(),
    ...stats
  });
}

/**
 * Busca pedidos que não estão nos status finais (Shipped ou Canceled).
 * Limitamos aos últimos 15 dias para evitar consultas infinitas no passado e economizar API.
 */
export async function getPendingOrdersFromDB(marketplaceId: string): Promise<OrderRow[]> {
  const db = getServiceClient();
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  const { data, error } = await db
    .from('amazon_orders')
    .select('*')
    .eq('marketplace_id', marketplaceId)
    .in('status', ['Pending', 'PaymentPending', 'PartiallyShipped', 'Unshipped'])
    .gte('created_at', fifteenDaysAgo.toISOString());

  if (error) {
    console.error('[Supabase] Erro ao buscar pedidos pendentes:', error.message);
    return [];
  }
  return (data || []) as OrderRow[];
}

/**
 * Busca o último registro de sincronização de um tipo específico (ex: refresh_status).
 */
export async function getLastSyncByType(marketplaceId: string, type: string): Promise<Date | null> {
  const db = getServiceClient();
  let query = db
    .from('amazon_sync_log')
    .select('synced_at')
    .eq('marketplace_id', marketplaceId);

  if (type === 'all') {
    // Qualquer registro de sync de pedidos (completo, incremental ou pulse)
    query = query.in('sync_type', ['full', 'incremental', 'incremental_pulse', 'refresh_status']);
  } else if (type === 'any_order_sync') {
    // Filtro mais amplo para cooldowns gerais
    query = query.in('sync_type', ['full', 'incremental', 'incremental_pulse', 'refresh_status', 'refresh_daily']);
  } else {
    // Busca tipo exato
    query = query.eq('sync_type', type);
  }

  const { data } = await query
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? new Date(data.synced_at) : null;
}
