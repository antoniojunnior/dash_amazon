import { getPricing } from '@/lib/api/dashboard';

export const metadata = { title: 'Precificação · Ops Control' };

export default async function PricingPage() {
  const pricingData = await getPricing();

  const buyboxWins  = pricingData.filter((p) => p.has_buybox).length;
  const needsAction = pricingData.filter((p) => p.status === 'needs_action').length;
  const optimized   = pricingData.filter((p) => p.status === 'optimized').length;
  const avgMargin   = (pricingData.reduce((acc, p) => acc + p.margin_percentage, 0) / pricingData.length).toFixed(1);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="flex flex-col flex-1 min-w-0">

      {/* Header — Padrão Operacional MD3 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-sm font-bold text-on-surface">Estratégia de Precificação</h1>
          <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
            Monitoramento em tempo real de BuyBox e margens de lucro
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-tonal gap-2 h-10 px-5 rounded-xl shadow-sm">
            <span className="material-symbols-outlined text-[20px]">history</span>
            Histórico
          </button>
          <button className="btn-primary gap-2 h-10 px-5 rounded-xl shadow-sm">
            <span className="material-symbols-outlined text-[20px]">rebase_edit</span>
            Repreçar Todos
          </button>
        </div>
      </div>

      <div className="space-y-8 w-full pb-10">

        {/* KPI Grid — Strategic Pricing Performance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { value: `${buyboxWins} SKUs`,  label: 'BuyBox Dominância',    icon: 'verified',        bg: 'bg-primary-container/30', color: 'text-primary' },
            { value: `${avgMargin}%`,      label: 'Margem Média ROI',     icon: 'analytics',       bg: 'bg-success-container/30', color: 'text-success' },
            { value: `${needsAction} SKUs`, label: 'Ações Urgentes',      icon: 'priority_high',   bg: 'bg-error-container/30',   color: 'text-error' },
            { value: `${optimized} SKUs`,   label: 'Preços Otimizados',    icon: 'auto_awesome',    bg: 'bg-warning-container/30', color: 'text-warning' },
          ].map(({ value, label, icon, bg, color }) => (
            <div key={label} className="md3-card-interactive p-6 flex flex-col justify-between min-h-[110px] group">
              <div className="flex items-center justify-between">
                 <span className="text-label-sm font-bold text-on-surface-variant/70 uppercase tracking-widest leading-none">{label}</span>
                 <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0 shadow-sm transition-md3 group-hover:scale-110`}>
                    <span className={`material-symbols-outlined text-[20px] ${color} icon-filled`}>{icon}</span>
                 </div>
              </div>
              <div className="mt-4">
                <p className="text-headline-sm font-black text-on-surface mono tracking-tighter leading-none">{value}</p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <span className="material-symbols-outlined text-[100px]">{icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Table Card */}
        <div className="md3-card shadow-elevation-1 overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-col sm:flex-row sm:items-center justify-between bg-surface-container-low/30 gap-4">
             <div className="flex items-center gap-3">
               <div className="w-1.5 h-6 bg-primary rounded-full" />
               <h2 className="text-label-md font-black text-on-surface uppercase tracking-widest">Painel de Reprecificação Inteligente</h2>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/5">
                  Live Feed: Sincronizado
                </span>
             </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="md3-table !mb-0">
              <thead>
                <tr>
                  <th className="pl-8 w-[320px]">Produto & Identificação</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Market Price (BRL)</th>
                  <th className="text-center">BuyBox Health</th>
                  <th className="text-right">Pricing Window</th>
                  <th className="text-right">ROI Mg%</th>
                  <th className="text-right pr-8">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {pricingData.map((row) => (
                  <tr key={row.sku} className={`hover:bg-primary/[0.02] transition-md3 group ${!row.has_buybox ? 'bg-error-container/5' : ''}`}>
                    <td className="pl-8 py-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0 border border-outline-variant/10 text-on-surface-variant/20 group-hover:border-primary/30 transition-md3 shadow-sm">
                           <span className="material-symbols-outlined text-[24px]">tag</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-label-md font-black text-on-surface line-clamp-2 pr-4 group-hover:text-primary transition-colors leading-tight whitespace-normal" title={row.title}>
                            {row.title}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="mono text-[10px] bg-primary-container text-on-primary-container px-2 py-0.5 rounded-lg font-black tracking-tighter">
                              SKU: {row.sku}
                            </span>
                            <div className="h-3 w-[1px] bg-outline-variant/20" />
                            <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest truncate">
                              ASIN: {row.asin}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center py-6">
                       <span className={`badge-${row.status === 'optimized' ? 'success' : 'warning'} gap-1.5 !py-1.5 !px-3 font-black text-[10px] uppercase tracking-widest shadow-sm rounded-xl`}>
                          {row.status === 'optimized' ? 'Otimizado' : 'Revisar'}
                       </span>
                    </td>
                    <td className="text-right py-6">
                       <div className="flex flex-col items-end gap-1">
                         <span className="mono text-body-md font-black text-on-surface tracking-tighter">
                           {fmt(row.current_price)}
                         </span>
                         <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${
                           row.price_source === 'live' ? 'bg-success/5 text-success border-success/10' : 'bg-warning/5 text-warning border-warning/10'
                         }`}>
                           {row.price_source === 'live' ? 'Live · Amazon' : 'Histórico API'}
                         </span>
                       </div>
                    </td>
                    <td className="text-center py-6">
                       <div className="flex justify-center">
                         {row.has_buybox ? (
                           <div className="flex flex-col items-center gap-1 group/badge">
                              <span className="material-symbols-outlined text-success text-[28px] icon-filled drop-shadow-sm transition-md3 group-hover/badge:scale-110">verified</span>
                              <span className="text-[9px] font-black text-success uppercase tracking-widest">In BuyBox</span>
                           </div>
                         ) : (
                           <div className="flex flex-col items-center gap-1 opacity-20 filter grayscale hover:opacity-100 hover:grayscale-0 transition-md3 group/badge">
                              <span className="material-symbols-outlined text-error text-[28px] group-hover/badge:scale-110 transition-md3">report_problem</span>
                              <span className="text-[9px] font-black text-error uppercase tracking-widest">Out Box</span>
                           </div>
                         )}
                       </div>
                    </td>
                    <td className="text-right py-6">
                      <div className="flex flex-col items-end gap-2">
                         <div className="flex items-center gap-3">
                           <span className="mono text-[10px] font-black text-on-surface-variant/40 tracking-tighter">{fmt(row.min_price)}</span>
                           <div className="w-16 h-1.5 bg-surface-container rounded-full overflow-hidden shrink-0 relative shadow-inner">
                              <div 
                                className="absolute h-full bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" 
                                style={{ 
                                  left: '25%', 
                                  width: '50%' 
                                }} 
                              />
                           </div>
                           <span className="mono text-[10px] font-black text-on-surface-variant/40 tracking-tighter">{fmt(row.max_price)}</span>
                         </div>
                         <span className="text-[9px] font-black text-on-surface-variant/20 uppercase tracking-widest">Pricing Strategy Window</span>
                      </div>
                    </td>
                    <td className="text-right py-6">
                       <div className="flex flex-col items-end gap-1">
                         <span className={`mono text-body-md font-black tracking-tighter ${row.margin_percentage < 15 ? 'text-error animate-pulse' : 'text-success'}`}>
                           {row.margin_percentage}%
                         </span>
                         <span className="text-[9px] font-black text-on-surface-variant/20 uppercase tracking-widest leading-none">Net Margin</span>
                       </div>
                    </td>
                    <td className="text-right pr-8 py-6">
                       <button className="btn-tonal !py-2.5 !px-5 !rounded-2xl !text-[10px] font-black uppercase tracking-widest shadow-sm hover:ring-2 hover:ring-primary/20 active:scale-95 transition-md3 whitespace-nowrap">
                         Ajustar Preço
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
