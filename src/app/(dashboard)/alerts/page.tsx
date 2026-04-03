import { getAlerts } from '@/lib/api/dashboard';

export const metadata = { title: 'Alertas · Ops Control' };

const severityConfig: Record<string, { icon: string; color: string; badge: string }> = {
  critical: { icon: 'error',   color: 'text-red-500',   badge: 'badge-error'   },
  high:     { icon: 'warning', color: 'text-amber-500', badge: 'badge-warning' },
  info:     { icon: 'info',    color: 'text-blue-500',  badge: 'badge-info'    },
};

export default async function AlertsPage() {
  const alerts = await getAlerts();
  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <div className="flex flex-col flex-1 min-w-0">

      {/* Header — Padrão Operacional MD3 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-sm font-bold text-on-surface flex items-center gap-3">
             Alertas Operacionais
             {unreadCount > 0 && (
               <span className="bg-error text-surface text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                 {unreadCount} pendentes
               </span>
             )}
          </h1>
          <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">notifications_active</span>
            Central de inteligência e monitoramento de riscos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-tonal gap-2 h-10 px-5 rounded-xl shadow-sm">
            <span className="material-symbols-outlined text-[20px]">done_all</span>
            Librar Tudo
          </button>
        </div>
      </div>

      <div className="w-full pb-10">

        {alerts.length === 0 ? (
          <div className="md3-card p-12 flex flex-col items-center justify-center text-center bg-surface-container-low/30 border-dashed border-2 border-outline-variant/20 shadow-none">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 border border-outline-variant/10">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">notifications_off</span>
            </div>
            <h3 className="text-title-md font-black text-on-surface uppercase tracking-widest">Nenhum Alerta Ativo</h3>
            <p className="text-body-sm text-on-surface-variant max-w-[320px] mt-2 font-medium">Sua operação na Amazon está saudável. Novos alertas aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          <div className="md3-card shadow-elevation-1 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/30">
               <div className="flex items-center gap-3">
                 <div className="w-1.5 h-6 bg-primary rounded-full" />
                 <h2 className="text-title-sm font-black text-on-surface uppercase tracking-widest">Inbox Operacional</h2>
               </div>
            </div>

            <div className="divide-y divide-outline-variant/10">
              {alerts.map((alert) => {
                const cfg = severityConfig[alert.severity] ?? severityConfig['info'];
                const isCritical = alert.severity === 'critical';
                
                return (
                  <div
                    key={alert.id}
                    className={`flex gap-5 px-6 py-6 transition-all group relative hover:bg-primary/[0.01]
                      ${!alert.is_read ? 'bg-primary/[0.02]' : 'opacity-80'}`}
                  >
                    {!alert.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                    )}

                    <div className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center border transition-colors shadow-sm
                      ${isCritical ? 'bg-error-container/30 border-error/10' : 'bg-surface-container border-outline-variant/10 group-hover:border-primary/20'}`}>
                      <span className={`material-symbols-outlined text-[24px] icon-filled ${cfg.color}`}>
                        {cfg.icon}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <div className="flex flex-col gap-0.5">
                          <h4 className={`text-label-md font-black uppercase tracking-tight transition-colors ${!alert.is_read ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>
                            {alert.title}
                          </h4>
                          <span className="text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-widest">
                            {new Date(alert.created_at).toLocaleString('pt-BR', {
                              day: '2-digit', month: '2-digit', year: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <span className={`${cfg.badge} !px-3 !py-1 font-black text-[9px] uppercase tracking-widest shadow-sm`}>
                          {alert.severity}
                        </span>
                      </div>

                      <p className="text-body-sm text-on-surface-variant leading-relaxed line-clamp-2 font-medium mt-2 group-hover:text-on-surface transition-colors">
                        {alert.description}
                      </p>

                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-outline-variant/5">
                        {alert.reference_id && (
                          <div className="flex items-center gap-2">
                             <span className="material-symbols-outlined text-primary/40 text-[16px]">link</span>
                             <span className="mono text-[10px] font-black text-primary uppercase tracking-tighter bg-primary/5 px-2 py-0.5 rounded">
                               {alert.reference_id}
                             </span>
                          </div>
                        )}
                        <button className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5 ml-auto">
                          Ver Detalhes
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
