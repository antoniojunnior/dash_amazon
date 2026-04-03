'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/orders':    'Pedidos',
  '/inventory': 'Estoque',
  '/pricing':   'Precificação',
  '/alerts':    'Alertas',
  '/settings':  'Configurações',
};

function TopAppBarInner() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? 'Ops Control';

  return (
    <header className="h-16 bg-surface-container-low/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-40 border-b border-outline-variant/10">
      <div className="flex items-center gap-4">
        {/* Breadcrumb SaaS B2B */}
        <div className="flex items-center gap-2 text-label-md font-medium text-on-surface-variant/60">
          <span className="hover:text-primary transition-colors cursor-pointer">Amazon Brasil</span>
          <span className="material-symbols-outlined text-[16px] opacity-40">chevron_right</span>
          <span className="text-title-sm font-bold text-on-surface">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search / Global Actions */}
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-all">
          <span className="material-symbols-outlined text-[22px]">search</span>
        </button>

        <button
          className="relative w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant
                     hover:bg-surface-container-high transition-all group"
          aria-label="Notificações"
        >
          <span className="material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform">notifications</span>
          <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-error rounded-full border-2 border-surface-container-low" />
        </button>

        <div className="h-8 w-[1px] bg-outline-variant/20 mx-1" />

        <div className="flex items-center gap-3 pl-2 group cursor-pointer">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-label-md font-bold text-on-surface">Antonio Junnior</span>
            <span className="text-label-sm text-on-surface-variant/80">Admin</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shadow-sm group-hover:shadow-md transition-all">
            AJ
          </div>
        </div>
      </div>
    </header>
  );
}

export function TopAppBar() {
  return (
    <Suspense fallback={
      <header className="h-14 border-b border-black/[0.08] bg-white flex items-center px-6 sticky top-0 z-40">
        <div className="h-4 w-32 bg-surface-container animate-pulse rounded" />
      </header>
    }>
      <TopAppBarInner />
    </Suspense>
  );
}
