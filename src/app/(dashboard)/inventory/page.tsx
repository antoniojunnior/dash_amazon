import { getInventory } from '@/lib/api/dashboard';
import InventoryTable from '@/components/inventory/InventoryTable';

export const metadata = { title: 'Estoque · Ops Control' };

export default async function InventoryPage() {
  const inventory = await getInventory();

  // Cálculos de KPI Agregados
  const totalCost = inventory.reduce((acc, i) => acc + i.total_cost, 0);
  const potentialRevenue = inventory.reduce((acc, i) => acc + i.potential_revenue, 0);
  const atRiskCount = inventory.filter(i => i.status === 'at_risk' || i.status === 'out_of_stock').length;
  const totalRestockInvestment = inventory.reduce((acc, i) => acc + i.restock_cost, 0);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="flex flex-col flex-1 min-w-0">

      {/* Header — Padrão Operacional MD3 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-sm font-bold text-on-surface">Gestão de Inventário</h1>
          <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            Monitoramento de ativos e reposição: {inventory.length} ASINs ativos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-tonal gap-2 h-10 px-5 rounded-xl shadow-sm">
            <span className="material-symbols-outlined text-[20px]">file_download</span>
            Exportar
          </button>
          <button className="btn-primary gap-2 h-10 px-5 rounded-xl shadow-sm">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Novo Envio FBA
          </button>
        </div>
      </div>

      <div className="space-y-8 w-full pb-10">

        {/* KPI Grid — Patrimônio e Risco */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {[
            { value: fmt(totalCost),       label: 'Patrimônio FBA', icon: 'account_balance_wallet', bg: 'bg-primary-container/30', color: 'text-primary' },
            { value: fmt(potentialRevenue), label: 'Faturamento Potencial', icon: 'trending_up',            bg: 'bg-success-container/30',  color: 'text-success' },
            { value: atRiskCount.toString(), label: 'ASINs em Risco',        icon: 'warning',                bg: 'bg-error-container/30',    color: 'text-error' },
            { value: fmt(totalRestockInvestment), label: 'Invest. Reposição', icon: 'shopping_cart_checkout',  bg: 'bg-warning-container/30',  color: 'text-warning' },
          ].map(({ value, label, icon, bg, color }) => (
            <div key={label} className="md3-card p-6 flex flex-col justify-between min-h-[110px] relative overflow-hidden group shadow-elevation-1">
              <div className="flex items-center justify-between z-10">
                 <span className="text-label-md font-bold text-on-surface-variant/80 uppercase tracking-wider">{label}</span>
                 <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                    <span className={`material-symbols-outlined text-[20px] ${color} icon-filled`}>{icon}</span>
                 </div>
              </div>
              <div className="mt-4 z-10">
                <p className="text-headline-sm font-black text-on-surface mono tracking-tighter">{value}</p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                <span className="material-symbols-outlined text-[100px]">{icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Table Card */}
        <div className="md3-card shadow-elevation-1 overflow-hidden">
          <InventoryTable initialData={inventory} />
        </div>
      </div>
    </div>
  );
}
