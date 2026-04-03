'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/context/SidebarContext';

const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', icon: 'space_dashboard', label: 'Dashboard' },
      { href: '/orders',    icon: 'orders',          label: 'Pedidos' },
      { href: '/inventory', icon: 'inventory_2',     label: 'Estoque' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { href: '/pricing', icon: 'payments',              label: 'Precificação' },
      { href: '/alerts',  icon: 'notifications_active',  label: 'Alertas' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/settings', icon: 'settings', label: 'Configurações' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard' || pathname === '/'
      : pathname?.startsWith(href);

  return (
    <aside className={`fixed h-full flex flex-col bg-surface-container-low border-r border-outline-variant/20 z-50 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
      
      {/* Brand Logo & Toggle Container */}
      <div className={`h-20 flex items-center justify-between px-4 transition-all ${isCollapsed ? 'px-2' : 'px-6'}`}>
        {!isCollapsed && (
          <div className="flex flex-col animate-in fade-in duration-500">
            <span className="text-title-lg font-black text-primary tracking-tight leading-tight uppercase">
              Ops Control
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Amazon BR</span>
            </div>
          </div>
        )}
        
        <button 
          onClick={toggleSidebar}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-on-surface-variant/60 hover:bg-surface-container-high hover:text-primary transition-all active:scale-90 ${isCollapsed ? 'mx-auto' : ''}`}
          title={isCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
        >
          <span className={`material-symbols-outlined text-[22px] transition-transform duration-500 ${isCollapsed ? 'rotate-180' : ''}`}>
            {isCollapsed ? 'menu' : 'menu_open'}
          </span>
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto no-scrollbar pt-2 px-3 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            {!isCollapsed && (
              <p className="px-4 mb-2 text-[10px] font-black text-on-surface-variant/30 uppercase tracking-[0.2em] animate-in fade-in slide-in-from-left-2 duration-300">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map(({ href, icon, label }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      title={isCollapsed ? label : ''}
                      className={`
                        group flex items-center gap-3 rounded-xl text-label-lg font-bold
                        transition-all duration-200 relative overflow-hidden
                        ${isCollapsed ? 'px-0 justify-center h-12 w-12 mx-auto' : 'px-4 py-3'}
                        ${active
                          ? 'bg-primary-container text-on-primary-container shadow-sm'
                          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                        }
                      `}
                    >
                      <span
                        className={`material-symbols-outlined transition-transform group-hover:scale-110 ${isCollapsed ? 'text-[24px]' : 'text-[22px] shrink-0'}`}
                        style={{
                          fontVariationSettings: active
                            ? "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24"
                            : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                        }}
                      >
                        {icon}
                      </span>
                      {!isCollapsed && (
                        <span className="truncate animate-in fade-in slide-in-from-left-1 duration-200">{label}</span>
                      )}
                      
                      {/* Active Indicator Bar Sapphire */}
                      {active && !isCollapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {isCollapsed && <div className="h-[1px] bg-outline-variant/10 mx-2 my-4" />}
          </div>
        ))}
      </nav>

      {/* Bottom Profile Container */}
      <div className={`p-4 bg-surface-container-low border-t border-outline-variant/10 transition-all ${isCollapsed ? 'px-2' : ''}`}>
        <div className={`flex items-center gap-3 p-2 rounded-2xl bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer border border-transparent hover:border-outline-variant/20 group ${isCollapsed ? 'justify-center w-12 h-12 mx-auto px-0' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-lg shadow-sm group-hover:shadow-md transition-all shrink-0">
            AJ
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1 animate-in fade-in duration-300">
              <p className="text-title-sm font-bold text-on-surface truncate leading-none">Antonio Junnior</p>
              <p className="text-[10px] font-black text-on-surface-variant/40 mt-1 uppercase tracking-tighter">Gestor Master</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
