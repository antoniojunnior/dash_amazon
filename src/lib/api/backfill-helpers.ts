/**
 * backfill-helpers.ts
 *
 * Funções auxiliares compartilhadas entre o motor de sync em dashboard.ts
 * e o endpoint de backfill em /api/sync/backfill/route.ts.
 *
 * Separadas aqui para evitar importar o módulo de dashboard completo
 * dentro de uma API Route (que causaria re-import de dependências server-only).
 */

/**
 * Mapeia o payload bruto da SP-API para o formato interno de Order,
 * incluindo o motor de imputação de receita para pedidos pendentes.
 */
export function mapRawOrdersForBackfill(amzOrders: any[]): any[] {
  const mapped = amzOrders.map((o: any) => {
    // Se o pedido já tiver itens (ex: de uma busca getOrderItems prévia), usamos eles
    const existingItems = o.items || [];
    
    return {
      id:                  o.AmazonOrderId || o.id,
      amazon_order_id:     o.AmazonOrderId || o.id,
      created_at:          o.PurchaseDate || o.created_at,
      status:              (o.OrderStatus || o.status || 'Pending').toLowerCase() === 'unshipped'
                             ? 'pending'
                             : (o.OrderStatus || o.status || 'Pending').toLowerCase(),
      fulfillment_channel: (o.FulfillmentChannel === 'AFN' || o.fulfillment_channel === 'FBA') ? 'FBA' : 'FBM',
      total:               o.OrderTotal ? parseFloat(o.OrderTotal.Amount) : (o.total || 0),
      items:               existingItems.length > 0 ? existingItems : [{
        title:    `Sincronizando produtos...`,
        sku:      '...',
        asin:     '...',
        quantity: (o.NumberOfItemsShipped ?? 0) + (o.NumberOfItemsUnshipped ?? 0),
        price:    0
      }],
    };
  });

  // Motor de Imputação de Receita Pendente (Estratégia Melhorada)
  // Se o total é 0, tentamos estimar pelo ticket médio do lote ATUAL.
  // Nota: O dashboard.ts ainda fará uma estimativa mais precisa usando Live Prices se este falhar.
  const approved    = mapped.filter(o => o.total > 0 && o.status !== 'canceled');
  let avgTicket     = 0;

  if (approved.length > 0) {
    const sumTotal = approved.reduce((acc, o) => acc + o.total, 0);
    const sumUnits = approved.reduce((acc, o) => acc + o.items[0].quantity, 0);
    avgTicket = sumUnits > 0 ? sumTotal / sumUnits : 0;
  }

  mapped.forEach(o => {
    if (o.total === 0 && (o.status === 'pending' || o.status === 'payment_pending')) {
      o.total = parseFloat((avgTicket * o.items[0].quantity).toFixed(2));
    }
  });

  return mapped;
}
