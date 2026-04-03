'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InventoryRow } from '@/types';
import { saveProductMetaAction } from '@/lib/actions/inventory';

interface Props {
  initialData: InventoryRow[];
}

export default function InventoryTable({ initialData }: Props) {
  const router = useRouter();
  const [data, setData] = useState<InventoryRow[]>(initialData);
  const [editingAsin, setEditingAsin] = useState<string | null>(null);
  const [tempCost, setTempCost] = useState<string>('');
  const [tempLeadTime, setTempLeadTime] = useState<string>('');
  const [loading, setLoading] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleEdit = (row: InventoryRow) => {
    setEditingAsin(row.asin);
    setTempCost(row.unit_cost.toString());
    setTempLeadTime(row.lead_time_days.toString());
  };

  const handleSave = async (asin: string) => {
    const cost = parseFloat(tempCost);
    const leadTime = parseInt(tempLeadTime);
    if (isNaN(cost) || isNaN(leadTime)) return;

    setLoading(asin);
    try {
      await saveProductMetaAction(asin, { unit_cost: cost, lead_time_days: leadTime });
      
      setData(prev => prev.map(row => {
        if (row.asin === asin) {
          const newRow = { 
            ...row, 
            unit_cost: cost,
            lead_time_days: leadTime,
            total_cost: row.available * cost,
            restock_cost: row.restock_quantity * cost
          };
          
          if (newRow.available > 0) {
            if (leadTime > 0 && newRow.coverage_days < leadTime) {
              newRow.status = 'at_risk' as const;
            } else {
              newRow.status = 'active' as const;
            }
          }
          return newRow;
        }
        return row;
      }));
      setEditingAsin(null);
      router.refresh();
    } catch (err) {
      console.error('Erro ao salvar metadados:', err);
      alert('Falha ao salvar metadados.');
    } finally {
      setLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return (
        <span className="badge-success gap-1.5 !px-3 font-black text-[10px] uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
          Em Estoque
        </span>
      );
      case 'at_risk': return (
        <span className="badge-warning gap-1.5 !px-3 font-black text-[10px] uppercase tracking-widest shadow-sm">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          Risco Ruptura
        </span>
      );
      case 'out_of_stock': return (
        <span className="badge-error gap-1.5 !px-3 font-black text-[10px] uppercase tracking-widest animate-pulse">
          <span className="material-symbols-outlined text-[14px] icon-filled">error</span>
          Esgotado
        </span>
      );
      case 'inactive': return (
        <span className="badge-neutral !px-3 font-black text-[10px] uppercase tracking-widest opacity-60">
          Descontinuado
        </span>
      );
      default: return <span className="badge-info">{status}</span>;
    }
  };

  // Filtragem combinada
  const filteredData = data.filter(row => {
    const matchesSearch = 
      row.asin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = showInactive ? true : row.status !== 'inactive';
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col w-full bg-white">
      {/* Barra de Filtros Refinada — Elite MD3 */}
      <div className="px-6 py-5 border-b border-outline-variant/10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-surface-container-low/40">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 w-full lg:w-auto">
          <div className="relative group w-full lg:w-96">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/30 group-focus-within:text-primary transition-md3 text-[20px] icon-filled">search</span>
            <input 
              type="text" 
              placeholder="Pesquisar ASIN, SKU ou Título..." 
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl pl-12 pr-4 py-3 text-body-sm focus:ring-4 focus:ring-primary/10 focus:border-primary transition-md3 placeholder:text-on-surface-variant/20 font-bold tracking-tight shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="h-8 w-[1.5px] bg-outline-variant/10 hidden sm:block" />

          <button 
             onClick={() => setShowInactive(!showInactive)}
             className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border-2 transition-md3 select-none shadow-sm
                        ${showInactive ? 'bg-primary/5 border-primary text-primary font-black' : 'bg-transparent border-outline-variant/10 text-on-surface-variant/50 hover:bg-surface-container font-bold'}`}
          >
             <div className={`w-10 h-5 rounded-full relative transition-md3 ${showInactive ? 'bg-primary' : 'bg-on-surface-variant/20'}`}>
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-md3 shadow-sm ${showInactive ? 'left-6' : 'left-1'}`} />
             </div>
             <span className="text-label-md uppercase tracking-widest whitespace-nowrap">Exibir Inativos</span>
          </button>
        </div>
        
        <div className="flex items-center gap-3 shrink-0 self-end lg:self-auto">
           <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest bg-surface-container/50 px-4 py-2 rounded-xl border border-outline-variant/5 shadow-sm">
            {filteredData.length} <span className="opacity-40">Ativos no Catálogo</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar px-1">
        <table className="md3-table !mb-0">
          <thead>
            <tr>
              <th className="pl-8 w-[360px]">Catálogo / Amazon Identificação</th>
              <th className="text-center">Status</th>
              <th className="text-right">Unidades</th>
              <th className="text-right">Lead Time</th>
              <th className="text-right">Custo Aquisição</th>
              <th className="text-right">Vlr. Patrimônio</th>
              <th className="text-right">Reposição</th>
              <th className="text-right pr-8">Giro & Saúde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {filteredData.map((row) => (
              <tr key={row.asin} className={`hover:bg-primary/[0.02] transition-md3 group ${row.status === 'out_of_stock' ? 'bg-error-container/5' : ''}`}>
                <td className="pl-8 py-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0 border border-outline-variant/10 text-on-surface-variant/20 group-hover:border-primary/30 transition-md3 shadow-sm">
                       <span className="material-symbols-outlined text-[24px]">view_in_ar</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-label-md font-black text-on-surface line-clamp-2 pr-4 group-hover:text-primary transition-colors leading-tight whitespace-normal" title={row.title}>
                        {row.title}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="mono text-[10px] bg-primary-container text-on-primary-container px-2 py-0.5 rounded-lg font-black tracking-tighter">
                          {row.asin}
                        </span>
                        <div className="h-3 w-[1px] bg-outline-variant/20" />
                        <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest truncate max-w-[120px]">
                          SKU: {row.sku}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="text-center py-6">{getStatusBadge(row.status)}</td>
                <td className="text-right py-6">
                  <div className="flex flex-col items-end gap-1">
                    <span className={`mono text-body-md font-black tracking-tighter ${row.available === 0 ? 'text-error animate-pulse' : 'text-on-surface'}`}>
                      {row.available} <span className="text-[10px] font-bold opacity-30 tracking-widest">UN.</span>
                    </span>
                    {row.in_transit > 0 && (
                      <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black uppercase tracking-tighter shadow-sm">+{row.in_transit} EM TRÂNSITO</span>
                    )}
                  </div>
                </td>
                <td className="text-right py-6">
                  {editingAsin === row.asin ? (
                    <input
                      type="number"
                      className="w-20 px-3 py-1.5 text-right text-label-md bg-surface-container border-2 border-primary rounded-xl shadow-elevation-2 font-black mono outline-none transition-md3 focus:ring-4 focus:ring-primary/10"
                      value={tempLeadTime}
                      onChange={(e) => setTempLeadTime(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <div 
                       className="flex items-center justify-end gap-1.5 cursor-pointer hover:text-primary transition-md3 group/edit"
                       onClick={() => handleEdit(row)}
                    >
                      <span className="mono text-body-sm font-black text-on-surface-variant/60 group-hover/edit:text-primary">
                        {row.lead_time_days > 0 ? `${row.lead_time_days}D` : '--'}
                      </span>
                      <span className="material-symbols-outlined text-[14px] opacity-0 group-hover/edit:opacity-100 transition-opacity">edit</span>
                    </div>
                  )}
                </td>
                <td className="text-right py-6">
                  {editingAsin === row.asin ? (
                    <div className="flex flex-col gap-2 items-end">
                      <input
                        type="number"
                        step="0.01"
                        className="w-28 px-3 py-1.5 text-right text-label-md bg-surface-container border-2 border-primary rounded-xl shadow-elevation-2 font-black mono outline-none transition-md3 focus:ring-4 focus:ring-primary/10"
                        value={tempCost}
                        onChange={(e) => setTempCost(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave(row.asin)}
                      />
                      <div className="flex gap-1.5">
                        <button onClick={() => setEditingAsin(null)} className="h-8 w-8 flex items-center justify-center rounded-lg text-on-surface-variant/40 hover:bg-surface-container-high transition-colors"><span className="material-symbols-outlined text-[18px]">close</span></button>
                        <button onClick={() => handleSave(row.asin)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-surface shadow-elevation-2 hover:scale-105 active:scale-95 transition-all"><span className="material-symbols-outlined text-[18px] icon-filled">check</span></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end group/edit gap-1">
                      <span 
                        className={`mono text-body-md font-black tracking-tighter cursor-pointer transition-colors ${row.unit_cost === 0 ? 'text-on-surface-variant/20 italic font-medium' : 'text-on-surface group-hover:text-primary'}`}
                        onClick={() => handleEdit(row)}
                      >
                        {row.unit_cost > 0 ? fmt(row.unit_cost) : 'Não definido'}
                      </span>
                      <span className="text-[9px] font-black text-on-surface-variant/20 uppercase tracking-widest leading-none">Custo Unitário</span>
                    </div>
                  )}
                </td>
                <td className="text-right py-6">
                  <div className="flex flex-col items-end gap-1">
                    <span className={`mono text-body-md font-black tracking-tighter ${row.total_cost > 0 ? 'text-on-surface' : 'text-on-surface-variant/10'}`}>
                      {fmt(row.total_cost)}
                    </span>
                    <span className="text-[10px] font-black text-primary/30 uppercase tracking-tighter leading-none">Equity Estimado</span>
                  </div>
                </td>
                <td className="text-right py-6">
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`mono text-body-md font-black tracking-tighter ${row.restock_cost > 0 ? 'text-warning' : 'text-on-surface-variant/10'}`}>
                      {row.restock_cost > 0 ? fmt(row.restock_cost) : '-'}
                    </span>
                    {row.restock_quantity > 0 && (
                      <span className="text-[9px] bg-warning/10 text-warning px-2 py-0.5 rounded-lg font-black tracking-widest uppercase border border-warning/10 shadow-sm">
                         {row.restock_quantity} UN Pend.
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-right pr-8 py-6">
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-baseline gap-1">
                       <span className="mono text-body-md font-black text-on-surface tracking-tighter leading-none">{row.units_30d}</span>
                       <span className="text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-widest">30D</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-tighter border shadow-sm transition-md3 ${
                      row.coverage_days < 15 ? 'bg-error-container/40 text-error border-error/20' : 
                      row.coverage_days < 30 ? 'bg-warning-container/40 text-warning border-warning/20' :
                      'bg-success-container/40 text-success border-success/20'
                    }`}>
                       <span className="material-symbols-outlined text-[14px] icon-filled">health_metrics</span>
                       {row.coverage_days === 999 ? 'Saudável' : `${row.coverage_days}D Faltantes`}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
