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
  const mapped = amzOrders.map((o: any) => ({
    id:                  o.AmazonOrderId,
    amazon_order_id:     o.AmazonOrderId,
    created_at:          o.PurchaseDate,
    status:              o.OrderStatus.toLowerCase() === 'unshipped'
                           ? 'pending'
                           : o.OrderStatus.toLowerCase(),
    fulfillment_channel: o.FulfillmentChannel === 'AFN' ? 'FBA' : 'FBM',
    total:               o.OrderTotal ? parseFloat(o.OrderTotal.Amount) : 0,
    items: [{
      title:    `Pedido ${o.AmazonOrderId}`,
      sku:      '...',
      quantity: (o.NumberOfItemsShipped ?? 0) + (o.NumberOfItemsUnshipped ?? 0),
    }],
  }));

  // Motor de Imputação de Receita Pendente
  // Pedidos "pending" chegam com total = 0 da Amazon.
  // Estimamos com base no ticket médio dos pedidos aprovados do mesmo lote.
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
