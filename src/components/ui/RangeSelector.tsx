'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const RANGES = [
  { value: 'today',     label: 'Hoje'        },
  { value: 'yesterday', label: 'Ontem'       },
  { value: '7d',        label: '7 dias'      },
  { value: '30d',       label: '30 dias'     },
  { value: 'custom',    label: 'Personalizado'},
];

interface Props {
  currentRange: string;
  from?: string;
  to?: string;
}

export function RangeSelector({ currentRange, from: initFrom = '', to: initTo = '' }: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const [showPicker, setShowPicker] = useState(currentRange === 'custom');
  const [from, setFrom]             = useState(initFrom);
  const [to, setTo]                 = useState(initTo);

  function navigate(range: string, f?: string, t?: string) {
    const params = new URLSearchParams();
    params.set('range', range);
    if (range === 'custom' && f && t) {
      params.set('from', f);
      params.set('to', t);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleChip(value: string) {
    if (value === 'custom') {
      setShowPicker(true);
    } else {
      setShowPicker(false);
      navigate(value);
    }
  }

  function handleApply() {
    if (from && to && from <= to) {
      navigate('custom', from, to);
    }
  }

  // Label dinâmico no chip Personalizado quando há período ativo
  const customLabel =
    currentRange === 'custom' && initFrom && initTo
      ? `${initFrom.slice(5).replace('-', '/')} – ${initTo.slice(5).replace('-', '/')}`
      : 'Personalizado';

  return (
    <div className="flex items-start gap-1 flex-wrap">
      {/* Chips de período */}
      <div className="flex items-center gap-0.5 flex-wrap">
      {RANGES.map(({ value, label }) => {
        const isActive = currentRange === value;
        const displayLabel = value === 'custom' ? customLabel : label;
        return (
          <button
            key={value}
            onClick={() => handleChip(value)}
            className={`
              px-3 py-1 rounded-full text-label-md font-medium transition-all duration-150 whitespace-nowrap
              ${isActive
                ? 'bg-primary text-white shadow-elevation-1'
                : 'text-on-surface-variant hover:bg-black/[0.05]'
              }
            `}
          >
            {displayLabel}
          </button>
        );
      })}
      </div>

      {/* Date picker inline — aparece quando Personalizado está expandido */}
      {showPicker && (
        <div className="flex flex-wrap items-end gap-2 bg-white border border-black/[0.10] rounded-md shadow-elevation-3 px-3 py-2.5 z-50 mt-1">
          <div className="flex flex-col">
            <label className="text-label-sm text-on-surface-variant mb-0.5">De</label>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={e => setFrom(e.target.value)}
              className="text-body-sm border border-outline/40 rounded-sm px-2 py-1.5 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-label-sm text-on-surface-variant mb-0.5">Até</label>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={e => setTo(e.target.value)}
              className="text-body-sm border border-outline/40 rounded-sm px-2 py-1.5 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApply}
              disabled={!from || !to || from > to}
              className="px-4 py-1.5 bg-primary text-white rounded-full text-label-md font-medium
                         disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              Aplicar
            </button>

            <button
              onClick={() => { setShowPicker(false); if (currentRange === 'custom') navigate('today'); }}
              className="text-on-surface-variant hover:text-on-surface transition-colors p-1"
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
