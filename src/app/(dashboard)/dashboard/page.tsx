import { getDashboardSummary, getAlerts } from '@/lib/api/dashboard';
import { RangeSelector } from '@/components/ui/RangeSelector';
import type { ChartDataPoint } from '../../../types';

export const metadata = { title: 'Dashboard · Ops Control' };

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const { range = 'today', from, to } = await searchParams;
  const data = await getDashboardSummary(range, from, to);
  const alerts = await getAlerts();
  const chartData: ChartDataPoint[] = data.chartData || [];
  const maxSales = Math.max(...chartData.map((d) => d.sales), 1);
  
  // Heatmap Logic: Volume de Unidades
  const unitsArray = chartData.map(d => d.units);
  const minUnits = Math.min(...unitsArray, 0);
  const maxUnits = Math.max(...unitsArray, 1);

  const getHeatmapColor = (units: number) => {
    if (maxUnits === minUnits) return 'var(--primary)';
    const ratio = (units - minUnits) / (maxUnits - minUnits);
    // Sapphire Sequential: Light Blue to Deep Sapphire
    // HSL(210, 100, 96) -> HSL(221, 83, 53)
    const h = 210 + (221 - 210) * ratio;
    const s = 100 - (100 - 83) * ratio;
    const l = 96 - (96 - 53) * ratio;
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="flex flex-col flex-1 min-w-0">

      {/* Header com Range Selector — Racionalizado MD3 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-sm font-bold text-on-surface">Visão Operacional</h1>
          <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            Análise de performance: {data.rangeLabel}
          </p>
        </div>
        <div className="bg-surface-container-low p-1 rounded-xl shadow-sm border border-outline-variant/10">
          <RangeSelector currentRange={range} from={from} to={to} />
        </div>
      </div>

      <div className="space-y-8 w-full pb-10">

        {/* KPI Grid — Padrão MD3 Elevated Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">

          {/* Vendas */}
          <div className="md3-card-interactive p-6 flex flex-col justify-between min-h-[140px] group">
            <div className="flex items-center justify-between">
              <span className="text-label-sm font-bold text-on-surface-variant/70 uppercase tracking-widest">Faturamento Gross</span>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${(data.vendas_hoje_var ?? 0) >= 0 ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'}`}>
                <span className="material-symbols-outlined text-[14px]">{(data.vendas_hoje_var ?? 0) >= 0 ? 'trending_up' : 'trending_down'}</span>
                {Math.abs(data.vendas_hoje_var ?? 0)}%
              </div>
            </div>
            <div className="mt-4">
              <p className="text-headline-sm font-black text-on-surface mono tracking-tighter leading-none">
                {fmt(data.vendas_hoje ?? 0)}
              </p>
              <p className="text-[10px] font-bold text-on-surface-variant/40 mt-3 uppercase tracking-tighter">Performance no período</p>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
              <span className="material-symbols-outlined text-[80px]">payments</span>
            </div>
          </div>

          {/* Unidades */}
          <div className="md3-card-interactive p-6 flex flex-col justify-between min-h-[140px] group">
            <div className="flex items-center justify-between">
              <span className="text-label-sm font-bold text-on-surface-variant/70 uppercase tracking-widest">Volume Saída</span>
              <div className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full text-[10px] font-black">
                {data.unidades_vendidas ?? 0} UN.
              </div>
            </div>
            <div className="mt-4">
              <p className="text-headline-sm font-black text-on-surface mono tracking-tighter leading-none">
                {data.unidades_vendidas ?? 0}
              </p>
              <p className="text-[10px] font-bold text-on-surface-variant/40 mt-3 uppercase tracking-tighter">Itens processados</p>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
              <span className="material-symbols-outlined text-[80px]">inventory_2</span>
            </div>
          </div>

          {/* Ticket Médio */}
          <div className="md3-card-interactive p-6 flex flex-col justify-between min-h-[140px] group">
            <div className="flex items-center justify-between">
              <span className="text-label-sm font-bold text-on-surface-variant/70 uppercase tracking-widest">Ticket Médio (Item)</span>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${(data.ticket_medio_var ?? 0) >= 0 ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'}`}>
                {Math.abs(data.ticket_medio_var ?? 0)}%
              </div>
            </div>
            <div className="mt-4">
              <p className="text-headline-sm font-black text-on-surface mono tracking-tighter leading-none">
                {fmt(data.ticket_medio ?? 0)}
              </p>
              <p className="text-[10px] font-bold text-success/60 mt-3 uppercase tracking-tighter font-black">Margem Operacional OK</p>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
              <span className="material-symbols-outlined text-[80px]">receipt_long</span>
            </div>
          </div>

          {/* Pedidos */}
          <div className="md3-card-interactive p-6 flex flex-col justify-between min-h-[140px] group">
            <div className="flex items-center justify-between">
              <span className="text-label-sm font-bold text-on-surface-variant/70 uppercase tracking-widest">Conversões</span>
              <span className="material-symbols-outlined text-on-surface-variant/20">shopping_cart</span>
            </div>
            <div className="mt-4">
              <p className="text-headline-sm font-black text-on-surface mono tracking-tighter leading-none">
                {data.pedidos_hoje ?? 0}
              </p>
              <p className="text-[10px] font-bold text-on-surface-variant/40 mt-3 uppercase tracking-tighter">Pedidos confirmados</p>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
              <span className="material-symbols-outlined text-[80px]">shopping_cart</span>
            </div>
          </div>

          {/* Estoque */}
          <div className="md3-card-interactive p-6 flex flex-col justify-between min-h-[140px] group">
            <div className="flex items-center justify-between">
              <span className="text-label-sm font-bold text-on-surface-variant/70 uppercase tracking-widest">Patrimônio FBA</span>
              <span className="material-symbols-outlined text-on-surface-variant/20">account_balance_wallet</span>
            </div>
            <div className="mt-4">
              <p className="text-headline-sm font-black text-on-surface mono tracking-tighter leading-none">
                {fmt(data.estoque_valorizado ?? 0)}
              </p>
              <p className="text-[10px] font-bold text-on-surface-variant/40 mt-3 uppercase tracking-tighter">{data.skus_ativos ?? 0} SKUs ativos</p>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
              <span className="material-symbols-outlined text-[80px]">account_balance_wallet</span>
            </div>
          </div>
        </section>

        {/* Main Operational Flow Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Bar Chart — Analytics Focus */}
          <div className="lg:col-span-8 md3-card p-8 flex flex-col group">
            <div className="flex items-start justify-between gap-4 mb-10">
              <div className="flex flex-col gap-1">
                <h2 className="text-title-sm font-black text-on-surface uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-primary rounded-full" />
                  Histórico de Performance
                </h2>
                <p className="text-body-sm text-on-surface-variant/60">Análise de volume financeiro diário: {data.rangeLabel}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                   <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Faturamento</span>
                </div>
                {/* Heatmap Legend */}
                <div className="flex items-center gap-2">
                   <div className="w-12 h-2.5 rounded-full bg-gradient-to-r from-primary/10 to-primary" />
                   <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Calor (Itens)</span>
                </div>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="empty-state h-64 bg-surface-container-low/40 rounded-2xl border border-dashed border-outline-variant/30">
                <div className="empty-state-icon">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">analytics</span>
                </div>
                <p className="text-label-lg font-black text-on-surface-variant uppercase tracking-widest">Aguardando dados...</p>
              </div>
            ) : (
              <div className="relative">
                <div className="h-64 flex items-end gap-1.5 px-2 relative">
                  {/* Grid Lines MD3 */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.03] z-0">
                    {[1, 2, 3, 4, 5].map((i) => <div key={i} className="w-full border-t border-on-surface" />)}
                  </div>

                  {chartData.map((pt, idx) => {
                    const h = maxSales > 0 ? (pt.sales / maxSales) * 100 : 0;
                    const heatmapColor = getHeatmapColor(pt.units);
                    return (
                      <div key={idx} className="group/bar relative flex-1 h-full flex flex-col justify-end z-10">
                        {/* Enhanced Tooltip */}
                        <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover/bar:opacity-100 transition-all duration-300 pointer-events-none scale-90 group-hover/bar:scale-100 origin-bottom">
                          <div className="bg-on-surface text-surface rounded-xl p-3 shadow-elevation-3 min-w-[140px] text-center border border-outline-variant/20">
                            <p className="text-[9px] uppercase font-black text-primary tracking-widest mb-1">{pt.label}</p>
                            <p className="text-body-md font-black mono whitespace-nowrap">{fmt(pt.sales)}</p>
                            <div className="mt-2 pt-2 border-t border-surface-variant/10 flex justify-between gap-3 text-[9px] font-black uppercase">
                              <span className="text-primary">{pt.units} un</span>
                              <span className="opacity-60">{pt.orders} ped</span>
                            </div>
                          </div>
                          <div className="w-2.5 h-2.5 bg-on-surface rotate-45 mx-auto -mt-1.5" />
                        </div>

                        {/* Heatmap Bar */}
                        <div
                          className="w-full max-w-[32px] mx-auto rounded-t-lg transition-all duration-500 ease-out relative overflow-hidden shadow-sm"
                          style={{ 
                            height: `${Math.max(h, 4)}%`,
                            backgroundColor: heatmapColor
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-40" />
                          <div className="absolute inset-0 bg-primary opacity-0 group-hover/bar:opacity-30 transition-opacity" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* X-Axis Rótulos */}
                <div className="flex gap-1 px-2 mt-8">
                  {chartData.map((pt, idx) => {
                    const isHourly = pt.label.endsWith('h');
                    const showLabel = !isHourly || (idx % 6 === 0) || (idx === chartData.length - 1);
                    return (
                      <div key={idx} className="flex-1 text-center">
                        {showLabel && (
                           <span className="text-[9px] font-black text-on-surface-variant/40 mono uppercase tracking-tighter group-hover:text-primary transition-md3">
                             {isHourly ? pt.label : (pt.label.includes('/') ? pt.label.split('/')[0] : pt.label)}
                           </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Inbox Operacional — Feed MD3 Style */}
          <div className="lg:col-span-4 md3-card flex flex-col group">
            <div className="p-8 border-b border-outline-variant/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-6 bg-error rounded-full animate-pulse" />
                <h2 className="text-title-sm font-black text-on-surface uppercase tracking-widest">Inbox Operacional</h2>
              </div>
              <span className="badge-error !rounded-lg !px-2.5 !py-1 text-[10px] uppercase font-black tracking-widest">
                {alerts.length} Críticos
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {alerts.length === 0 ? (
                <div className="empty-state p-12">
                   <div className="empty-state-icon !bg-success-container/20">
                      <span className="material-symbols-outlined text-success text-4xl icon-filled">check_circle</span>
                   </div>
                   <p className="text-label-lg font-black text-on-surface uppercase tracking-widest">Operação Limpa</p>
                   <p className="text-body-sm text-on-surface-variant/60 mt-1 max-w-[220px]">Nenhum alerta crítico ou recomendação pendente.</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/5">
                  {alerts.slice(0, 8).map((alert, idx) => (
                    <div 
                      key={idx} 
                      className="p-6 transition-all hover:bg-primary/[0.02] group/item cursor-pointer"
                    >
                      <div className="flex items-start gap-5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-md3 group-hover/item:scale-110 ${
                          alert.severity === 'critical' || alert.severity === 'high' 
                            ? 'bg-error-container text-on-error-container' 
                            : 'bg-warning-container text-on-warning-container'
                        }`}>
                          <span className="material-symbols-outlined text-[20px] icon-filled">
                            {alert.severity === 'critical' ? 'error' : 'warning'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                             <p className="text-label-md font-black text-on-surface group-hover/item:text-primary transition-md3 truncate">{alert.title}</p>
                             <span className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest shrink-0">há 2 horas</span>
                          </div>
                          <p className="text-body-sm text-on-surface-variant/60 mt-1.5 line-clamp-2 leading-relaxed">{alert.message || alert.description}</p>
                          <div className="flex items-center gap-4 mt-4">
                             <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-1.5">
                               Resolver Agora
                               <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                             </button>
                             <button className="text-[10px] font-black text-on-surface-variant/30 uppercase tracking-widest hover:text-on-surface-variant transition-colors">Arquivar</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 bg-surface-container-low/30 border-t border-outline-variant/10">
               <a href="/alerts" className="btn-tonal w-full !rounded-xl !h-12 !px-0 uppercase tracking-widest !text-[11px] font-black flex items-center justify-center gap-2">
                 Ver Central de Alertas
                 <span className="material-symbols-outlined text-[16px]">open_in_new</span>
               </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
