// Users and Auth
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'operator';
  avatar_url?: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  amazon_seller_id: string;
  created_at: string;
}

// Dashboard metrics
export interface ChartDataPoint {
  label: string;      // Label do eixo X (ex: "14h", "01/03")
  fullLabel?: string;  // Label detalhada p/ o tooltip (ex: "Sexta, 21/03")
  sales: number;      // Vendas nesse bucket
  orders: number;     // Pedidos nesse bucket
  units: number;      // Unidades nesse bucket
}

export interface DashboardSummary {
  vendas_hoje: number;
  vendas_hoje_var: number;
  pedidos_hoje: number;
  pedidos_hoje_var: number;
  unidades_vendidas?: number;
  ticket_medio: number;
  ticket_medio_var: number;
  estoque_valorizado: number;
  skus_ativos: number;
  acos_medio: number;
  acos_medio_var: number;
  buybox_win: number;
  chartData?: ChartDataPoint[];
  rangeLabel?: string;
}

// Orders
export interface OrderItem {
  sku: string;
  asin: string;
  title: string;
  quantity: number;
  price: number;
  image_url?: string;
}

export interface Order {
  id: string;
  amazon_order_id: string;
  created_at: string;
  status: 'pending' | 'shipped' | 'canceled' | 'payment_pending';
  fulfillment_channel: 'FBA' | 'FBM';
  total: number;
  items: OrderItem[];
}

// Inventory
export interface InventoryRow {
  sku: string;
  asin: string;
  title: string;
  fulfillment: 'FBA' | 'FBM';
  available: number;
  in_transit: number;
  sales_velocity: number;   // Vendas diárias (últimos 30 dias)
  coverage_days: number;
  risk_level: 'critical' | 'warning' | 'healthy' | 'excess';
  status: 'active' | 'inactive' | 'out_of_stock' | 'at_risk';
  unit_cost: number;        // Custo de Aquisição (COGS)
  lead_time_days: number;   // Prazo de Reposição (Compra -> Amazon Live)
  total_cost: number;       // Capital Imobilizado (Available * UnitCost)
  avg_price: number;        // Preço Médio de Venda (Amazon)
  current_price: number;    // Preço Atual (Live SP-API > Historical)
  price_source: 'live' | 'historical';
  potential_revenue: number; // Projeção de Faturamento (Available * CurrentPrice)
  restock_quantity: number; // Qtd necessária para 30 dias de giro
  restock_cost: number;     // Capital de Giro necessário para reposição
  units_30d: number;        // Volume total vendido no mês
  image_url?: string;
  last_updated?: string;
}

// Pricing
export interface PricingRow {
  sku: string;
  asin: string;
  title: string;
  current_price: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  buybox_price: number | null;
  competitor_price: number | null;
  margin_percentage: number;
  has_buybox: boolean;
  status: 'optimized' | 'needs_action' | 'paused';
  price_source: 'live' | 'historical';
}

export interface PricingSuggestion {
  id: string;
  sku: string;
  suggested_price: number;
  reason: string;
  projected_margin: number;
  created_at: string;
}

// Alerts
export interface Alert {
  id: string;
  type: 'inventory' | 'pricing' | 'fulfillment' | 'system';
  severity: 'critical' | 'high' | 'info';
  title: string;
  description: string;
  reference_id?: string; // sku or order id
  created_at: string;
  is_read: boolean;
}

// Settings
export interface SettingsProfile {
  id: string;
  amazon_seller_id: string;
  marketplace_region: string;
  repricer_enabled: boolean;
  repricer_min_margin: number;
  repricer_strategy: string;
}
