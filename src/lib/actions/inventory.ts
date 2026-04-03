'use server';

import { upsertProductMeta } from '../supabase/orders-repository';

/**
 * Server Action para salvar o custo de aquisição de um produto (ASIN).
 * Esta função é isolada para evitar o vazamento de dependências do servidor (como amazon-sp-api)
 * para o cliente.
 */
export async function saveProductMetaAction(asin: string, data: { unit_cost?: number, lead_time_days?: number }) {
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID!;
  
  if (!asin) throw new Error('ASIN é obrigatório');
  
  try {
    await upsertProductMeta({
      asin,
      marketplace_id: marketplaceId,
      unit_cost: data.unit_cost ?? 0,
      lead_time_days: data.lead_time_days ?? 0,
    });
    return { success: true };
  } catch (error) {
    console.error('[Action] Erro ao salvar metadados do produto:', error);
    throw new Error('Falha ao salvar metadados no banco de dados.');
  }
}
