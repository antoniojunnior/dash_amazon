import { getOrders } from '@/lib/api/dashboard';
import { RangeSelector } from '@/components/ui/RangeSelector';
import { Pagination, PerPageSelector } from '@/components/ui/Pagination';
import { Suspense } from 'react';
import type { Order } from '@/types';

export const metadata = { title: 'Pedidos · Ops Control' };

type Props = {
  searchParams: Promise<{
    range?:   string;
    from?:    string;
    to?:      string;
    status?:  string;
    page?:    string;
    perPage?: string;
  }>;
};

function rangeToWindow(range: string, from?: string, to?: string): number {
  if (range === 'today')     return 1;
  if (range === 'yesterday') return 2;
  if (range === '30d')       return 30;
  if (range === 'custom' && from && to) {
    const diff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
    return Math.max(diff + 1, 1);
  }
  return 7;
}

function filterByRange(orders: any[], range: string, from?: string, to?: string): any[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  if (range === 'today') {
    return orders.filter(o => new Date(o.created_at) >= todayStart);
  }
  if (range === 'yesterday') {
    const start = new Date(todayStart);
    start.setDate(todayStart.getDate() - 1);
    const end   = todayStart;
    return orders.filter(o => { const d = new Date(o.created_at); return d >= start && d < end; });
  }
  if (range === '30d') {
    const start = new Date(todayStart);
    start.setDate(todayStart.getDate() - 30);
    return orders.filter(o => new Date(o.created_at) >= start);
  }
  if (range === 'custom' && from && to) {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    const dateFrom = new Date(fy, fm - 1, fd, 0,  0,  0);
    const dateTo   = new Date(ty, tm - 1, td, 23, 59, 59, 999);
    return orders.filter(o => { const d = new Date(o.created_at); return d >= dateFrom && d <= dateTo; });
  }
  const start7 = new Date(todayStart);
  start7.setDate(todayStart.getDate() - 7);
  return orders.filter(o => new Date(o.created_at) >= start7);
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:         { label: 'Processando',    className: 'badge-warning' },
  shipped:         { label: 'Despachado',     className: 'badge-success' },
  payment_pending: { label: 'Pgto. Pendente', className: 'badge-warning' },
  canceled:        { label: 'Cancelado',      className: 'badge-error'   },
};

export default async function OrdersPage({ searchParams }: Props) {
  const {
    range = '7d',
    from,
    to,
    status: statusFilter,
    page:    pageParam    = '1',
    perPage: perPageParam  = '20',
  } = await searchParams;

  const currentPage = Math.max(1, parseInt(pageParam, 10));
  const perPage     = [10, 20, 50, 100].includes(parseInt(perPageParam, 10))
    ? parseInt(perPageParam, 10)
    : 20;

  const daysAgo     = rangeToWindow(range, from, to);
  const allOrders   = await getOrders(daysAgo);
  const rangeOrders = filterByRange(allOrders, range, from, to);

  const count = (s: string) => rangeOrders.filter((o: any) => o.status === s).length;
  const countProcessing     = count('pending');
  const countShipped        = count('shipped');
  const countPaymentPending = count('payment_pending');
  const countCanceled       = count('canceled');

  // KPIs Financeiros (Exclui cancelados)
  const financialOrders = rangeOrders.filter((o: any) => o.status !== 'canceled');
  const totalSales      = financialOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const totalOrdersCount = financialOrders.length;
  const avgTicket       = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;

  // Filtro de status (antes da paginação)
  const filteredOrders = statusFilter
    ? rangeOrders.filter((o: any) => o.status === statusFilter)
    : rangeOrders;

  // Paginação: fatia a lista filtrada para a página atual
  const totalItems    = filteredOrders.length;
  const totalPages    = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage      = Math.min(currentPage, totalPages);
  const startIdx      = (safePage - 1) * perPage;
  const displayOrders = filteredOrders.slice(startIdx, startIdx + perPage);

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  function statusHref(s?: string) {
    const p = new URLSearchParams();
    p.set('range', range);
    if (from) p.set('from', from);
    if (to)   p.set('to', to);
    if (s)    p.set('status', s);
    p.set('page', '1');
    p.set('perPage', String(perPage));
    return `/orders?${p.toString()}`;
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">

      {/* Header — Padrão Operacional MD3 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-sm font-bold text-on-surface">Gestão de Pedidos</h1>
          <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
            Monitoramento de faturamento e logística: {totalItems} registros
            <span className="ml-3 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-full border border-emerald-100 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              STATUS: V4-SYNC-ACTIVE
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-surface-container-low p-1 rounded-xl shadow-sm border border-outline-variant/10">
            <RangeSelector currentRange={range} from={from} to={to} />
          </div>
          <button className="btn-primary gap-2 h-10 px-5 rounded-xl shadow-sm">
            <span className="material-symbols-outlined text-[20px]">sync</span>
            Sincronizar
          </button>
        </div>
      </div>

      <div className="space-y-8 w-full pb-10">

        {/* Top KPIs — Financeiro B2B */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           <div className="md3-card-interactive p-6 flex flex-col justify-between min-h-[110px] group">
              <span className="text-label-sm font-bold text-on-surface-variant/70 uppercase tracking-widest">Faturamento Bruto</span>
              <div className="mt-4">
                <p className="text-headline-sm font-black text-on-surface mono tracking-tighter leading-none">{fmt(totalSales)}</p>
                <p className="text-[10px] font-bold text-on-surface-variant/40 mt-3 uppercase tracking-tighter">Volume total faturado</p>
              </div>
              <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <span className="material-symbols-outlined text-[80px]">payments</span>
              </div>
           </div>
           <div className="md3-card-interactive p-6 flex flex-col justify-between min-h-[110px] group">
              <span className="text-label-sm font-bold text-on-surface-variant/70 uppercase tracking-widest">Ticket Médio</span>
              <div className="mt-4">
                <p className="text-headline-sm font-black text-on-surface mono tracking-tighter leading-none">{fmt(avgTicket)}</p>
                <p className="text-[10px] font-bold text-success/60 mt-3 uppercase tracking-tighter font-black">Performance Financeira OK</p>
              </div>
              <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <span className="material-symbols-outlined text-[80px]">receipt_long</span>
              </div>
           </div>
           <div className="md3-card-interactive p-6 flex flex-col justify-between min-h-[110px] group">
              <span className="text-label-sm font-bold text-on-surface-variant/70 uppercase tracking-widest">Orders Volume</span>
              <div className="mt-4">
                <p className="text-headline-sm font-black text-on-surface mono tracking-tighter leading-none">
                  {totalOrdersCount} <span className="text-label-md font-bold opacity-30">PED.</span>
                </p>
                <p className="text-[10px] font-bold text-on-surface-variant/40 mt-3 uppercase tracking-tighter">Conversões validadas</p>
              </div>
              <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <span className="material-symbols-outlined text-[80px]">shopping_cart</span>
              </div>
           </div>
        </section>

        {/* Status breakdown — Elite MD3 Chips */}
        <section className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
          {[
            { count: countProcessing,     label: 'Processando',    value: 'pending',          icon: 'package_2',      color: 'text-amber-600', bg: 'bg-amber-50'  },
            { count: countShipped,        label: 'Despachados',    value: 'shipped',          icon: 'local_shipping', color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { count: countPaymentPending, label: 'Pgto. Pendente', value: 'payment_pending',  icon: 'payments',       color: 'text-blue-700',  bg: 'bg-blue-50'   },
            { count: countCanceled,       label: 'Cancelados',     value: 'canceled',         icon: 'block',          color: 'text-red-700',   bg: 'bg-red-50'    },
          ].map(({ count, label, value, icon, color, bg }) => (
            <a 
              key={label} 
              href={statusHref(value)}
              className={`md3-card-interactive min-w-[200px] p-5 flex items-center gap-4 transition-md3
                        ${statusFilter === value ? 'ring-2 ring-primary bg-primary/[0.03]' : 'border-outline-variant/10'}`}
            >
              <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center shrink-0 shadow-sm transition-md3 group-hover:scale-110`}>
                <span className={`material-symbols-outlined text-[24px] ${color} icon-filled`}>{icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black text-on-surface mono tracking-tighter leading-none">{count}</p>
                <p className="text-[10px] font-bold text-on-surface-variant/40 mt-1 uppercase tracking-widest truncate">{label}</p>
              </div>
            </a>
          ))}
          <a 
            href={statusHref(undefined)}
            className={`btn-tonal !rounded-2xl h-[88px] !px-8 border-2 shadow-sm transition-md3 ${!statusFilter ? 'ring-2 ring-primary border-transparent' : 'border-outline-variant/10'}`}
          >
            <div className="flex flex-col items-center gap-1">
               <span className="material-symbols-outlined text-[20px]">list_alt</span>
               <span className="text-[10px] font-black uppercase tracking-widest">Todos</span>
            </div>
          </a>
        </section>

        {/* Main Data Table Area */}
        <div className="md3-card flex flex-col shadow-elevation-1 overflow-hidden">
          {/* Table Toolbar */}
          <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-4 sm:gap-6">
               <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-primary" />
                 <span className="text-label-md font-bold text-on-surface whitespace-nowrap">{totalItems} <span className="opacity-60">registros</span></span>
               </div>
               <div className="hidden xs:block h-4 w-[1px] bg-outline-variant/20" />
               <Suspense fallback={null}>
                  <PerPageSelector perPage={perPage} />
               </Suspense>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
               <button className="btn-tonal !py-1.5 !px-3 rounded-lg text-xs gap-1.5 opacity-80 hover:opacity-100 transition-opacity whitespace-nowrap">
                  <span className="material-symbols-outlined text-[16px]">filter_list</span>
                  Filtros
               </button>
               <button className="btn-tonal !py-1.5 !px-3 rounded-lg text-xs gap-1.5 opacity-80 hover:opacity-100 transition-opacity whitespace-nowrap">
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Exportar
               </button>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="md3-table !mb-0 min-w-[1000px]">
              <thead>
                <tr>
                  <th className="pl-8 w-[220px]">ID do Pedido</th>
                  <th>Itens & Descrição Operacional</th>
                  <th className="w-[180px] text-right">Valor Total</th>
                  <th className="w-[180px] pr-8 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {displayOrders.map((order: Order) => {
                  const sc = STATUS_CONFIG[order.status] ?? { label: order.status, className: 'badge-neutral' };
                  return (
                    <tr key={order.id} className="hover:bg-primary/[0.02] transition-md3 group">
                      <td className="pl-8 py-6 align-top">
                        <div className="flex flex-col gap-1.5">
                          <span className="mono font-black text-primary text-body-md group-hover:underline cursor-pointer tracking-tighter">{order.amazon_order_id}</span>
                          <div className="flex flex-col gap-1">
                             <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase flex items-center gap-1.5">
                               <span className="material-symbols-outlined text-[14px]">event</span>
                               {new Date(order.created_at).toLocaleDateString('pt-BR')}
                             </span>
                             <span className="text-[10px] font-bold text-on-surface-variant/20 uppercase mono">
                               {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                             </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-6 pr-4 align-top">
                        <div className="flex flex-col gap-4">
                          {order.items?.map((item: any, idx: number) => {
                            const isSyncing = item.title === 'Sincronizando produtos...';
                            return (
                              <div key={idx} className="flex items-start gap-4 group/item">
                                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shrink-0 text-on-surface-variant/30 border border-outline-variant/10 shadow-sm group-hover/item:border-primary/20 transition-md3">
                                   <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-label-md font-black line-clamp-2 max-w-[420px] transition-colors leading-tight ${((item.title || item.Title) === 'Sincronizando produtos...' || !(item.title || item.Title)) ? 'text-on-surface-variant/30 italic' : 'text-on-surface group-hover/item:text-primary'}`}>
                                    {item.title || item.Title || (item.asin || item.ASIN ? `Item ${item.asin || item.ASIN}` : 'Processando Item...')}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <span className="px-2 py-0.5 bg-primary-container text-on-primary-container text-[10px] font-black rounded-lg mono tracking-tighter">
                                      {item.quantity > 0 ? `${item.quantity} UN.` : '--'}
                                    </span>
                                    <div className="h-3 w-[1px] bg-outline-variant/20" />
                                    {item.sku && item.sku !== '...' && (
                                      <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest truncate">
                                        SKU: {item.sku}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-6 text-right align-top">
                        <div className="flex flex-col items-end">
                           <span className="mono font-black text-on-surface text-body-lg tracking-tighter">{fmt(order.total)}</span>
                           <span className="text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-widest mt-1">BRL Total</span>
                           <div className="flex items-center gap-1 mt-2 text-[10px] text-success font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="material-symbols-outlined text-[14px]">verified</span>
                              PAGO
                           </div>
                        </div>
                      </td>
                      <td className="pr-8 py-6 text-center align-top">
                        <span className={`${sc.className} !py-2 !px-4 font-black text-[10px] uppercase tracking-widest shadow-sm rounded-xl`}>{sc.label}</span>
                      </td>
                    </tr>
                  );
                })}


                {displayOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-20 px-6">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
                           <span className="material-symbols-outlined text-4xl text-on-surface-variant/30">search_off</span>
                        </div>
                        <p className="text-title-sm font-black text-on-surface">Nenhum pedido localizado</p>
                        <p className="text-body-sm text-on-surface-variant/70 mt-1 max-w-[280px]">Tente ajustar o período ou o status operacional selecionado.</p>
                        <a href={statusHref(undefined)} className="btn-tonal mt-6 rounded-xl">Limpar Todos os Filtros</a>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="px-6 py-4 bg-surface-container-low/50 border-t border-outline-variant/10">
            <Suspense fallback={<div className="h-10 animate-pulse bg-outline-variant/10 rounded" />}>
              <Pagination
                totalItems={totalItems}
                currentPage={safePage}
                perPage={perPage}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
