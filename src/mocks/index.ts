import { DashboardSummary, Order, InventoryRow, PricingRow, Alert, SettingsProfile } from '../types';

export const mockDashboardSummary: DashboardSummary = {
  vendas_hoje: 42890,
  vendas_hoje_var: 12.4,
  pedidos_hoje: 312,
  pedidos_hoje_var: 5.1,
  ticket_medio: 137.46,
  ticket_medio_var: -2.3,
  estoque_valorizado: 1200000,
  skus_ativos: 4210,
  acos_medio: 14.2,
  acos_medio_var: -0.8,
  buybox_win: 94.8
};

export const mockOrders: Order[] = [
  {
    id: '114-8829102-111',
    amazon_order_id: '114-8829102-111',
    created_at: '2026-04-01T15:30:00Z',
    status: 'pending',
    fulfillment_channel: 'FBM',
    total: 249.90,
    items: [
      {
        sku: 'AMZ-228-MNT',
        asin: 'B07FGH4567',
        title: 'Suporte para Monitor Articulado de Mesa c/ Pistão',
        quantity: 1,
        price: 249.90
      }
    ]
  },
  {
    id: '113-4412234-902',
    amazon_order_id: '113-4412234-902',
    created_at: '2026-04-01T14:30:00Z',
    status: 'shipped',
    fulfillment_channel: 'FBA',
    total: 89.90,
    items: [
      {
        sku: 'AMZ-441-NIX',
        asin: 'B09ABC9876',
        title: 'Mouse Pad Extra Grande 900x400mm Speed Preto',
        quantity: 1,
        price: 89.90
      }
    ]
  }
];

export const mockInventory: InventoryRow[] = [
  {
    sku: 'AMZ-992-KLR',
    asin: 'B08XYZ1234',
    title: 'Teclado Mecânico RGB Switch Azul Premium Gamer X',
    fulfillment: 'FBA',
    available: 84,
    in_transit: 0,
    sales_velocity: 42,
    coverage_days: 2,
    risk_level: 'critical',
    status: 'at_risk',
    unit_cost: 85.00,
    lead_time_days: 15,
    total_cost: 7140,
    avg_price: 195.00,
    current_price: 199.90,
    price_source: 'live',
    potential_revenue: 16791.60,
    restock_quantity: 1200,
    restock_cost: 102000,
    units_30d: 1260
  },
  {
    sku: 'AMZ-441-NIX',
    asin: 'B09ABC9876',
    title: 'Mouse Pad Extra Grande 900x400mm Speed Preto',
    fulfillment: 'FBA',
    available: 1450,
    in_transit: 500,
    sales_velocity: 32,
    coverage_days: 45,
    risk_level: 'healthy',
    status: 'active',
    unit_cost: 25.00,
    lead_time_days: 30,
    total_cost: 36250,
    avg_price: 138.00,
    current_price: 145.00,
    price_source: 'live',
    potential_revenue: 210250,
    restock_quantity: 0,
    restock_cost: 0,
    units_30d: 960
  }
];

export const mockAlerts: Alert[] = [
  {
    id: 'a1',
    type: 'inventory',
    severity: 'critical',
    title: 'SKU AMZ-992-KLR com estoque Crítico (2 dias)',
    description: 'Giro acelerado detectado (+42 un/dia). Estoque atual de 84 unidades esgotará na quinta-feira. Perda projetada de receita: R$ 4.200/semana.',
    reference_id: 'AMZ-992-KLR',
    created_at: '2026-04-01T16:00:00Z',
    is_read: false
  },
  {
    id: 'a2',
    type: 'pricing',
    severity: 'high',
    title: 'Perda de BuyBox no SKU AMZ-441-NIX',
    description: 'Concorrente "MegaStore BR" reduziu preço em -2.4% (R$ 142,00). Auto-repricer pausado pois o limite de margem mínima (12%) seria violado.',
    reference_id: 'AMZ-441-NIX',
    created_at: '2026-03-31T16:00:00Z',
    is_read: false
  }
];

export const mockPricing: PricingRow[] = [
  {
    sku: 'AMZ-992-KLR',
    asin: 'B08XYZ1234',
    title: 'Teclado Mecânico RGB Switch Azul Premium Gamer X',
    current_price: 199.90,
    avg_price: 195.00,
    min_price: 169.90,
    max_price: 249.90,
    buybox_price: 199.90,
    competitor_price: null,
    margin_percentage: 22.5,
    has_buybox: true,
    status: 'optimized',
    price_source: 'live'
  },
  {
    sku: 'AMZ-441-NIX',
    asin: 'B09ABC9876',
    title: 'Mouse Pad Extra Grande 900x400mm Speed Preto',
    current_price: 145.00,
    avg_price: 142.00,
    min_price: 140.00,
    max_price: 180.00,
    buybox_price: 142.00,
    competitor_price: 142.00,
    margin_percentage: 16.0,
    has_buybox: false,
    status: 'needs_action',
    price_source: 'live'
  }
];
