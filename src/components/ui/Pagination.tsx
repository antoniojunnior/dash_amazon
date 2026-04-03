'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

interface PaginationProps {
  totalItems:  number;
  currentPage: number;
  perPage:     number;
}

interface PerPageSelectorProps {
  perPage: number;
}

// ── Seletor de itens por página (vai na toolbar superior da tabela) ────────────
export function PerPageSelector({ perPage }: PerPageSelectorProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  function navigate(pp: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('perPage', String(pp));
    params.set('page', '1'); // volta à p.1 ao mudar itens/pág
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-label-sm text-on-surface-variant whitespace-nowrap">Exibir:</span>
      <div className="flex items-center gap-0.5">
        {PER_PAGE_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => navigate(opt)}
            className={`
              px-2.5 py-1 rounded-full text-label-sm font-medium transition-all duration-150
              ${perPage === opt
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-on-surface-variant hover:bg-black/[0.06]'
              }
            `}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Navegação de páginas (fica no rodapé da tabela) ──────────────────────────
export function Pagination({ totalItems, currentPage, perPage }: PaginationProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const fromItem   = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const toItem     = Math.min(currentPage * perPage, totalItems);

  function navigate(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  function visiblePages(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-black/[0.06] flex-wrap">

      {/* Contador compacto */}
      <span className="text-label-md text-on-surface-variant">
        {totalItems === 0 ? '0 registros' : `${fromItem}–${toItem} de ${totalItems}`}
      </span>

      {/* Navegação de páginas */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(currentPage - 1)}
            disabled={currentPage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant
                       hover:bg-black/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Página anterior"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>

          {visiblePages().map((pg, idx) =>
            pg === '...' ? (
              <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-label-md text-on-surface-variant/50 select-none">
                …
              </span>
            ) : (
              <button
                key={pg}
                onClick={() => navigate(pg as number)}
                className={`
                  w-8 h-8 flex items-center justify-center rounded-full text-label-md font-medium transition-all duration-150
                  ${pg === currentPage
                    ? 'bg-primary text-white shadow-elevation-1'
                    : 'text-on-surface-variant hover:bg-black/[0.06]'
                  }
                `}
              >
                {pg}
              </button>
            )
          )}

          <button
            onClick={() => navigate(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant
                       hover:bg-black/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Próxima página"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
}
