'use client';

import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopAppBar } from '@/components/layout/TopAppBar';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main 
        className={`flex-1 flex flex-col min-h-screen relative transition-all duration-300 ease-in-out ${
          isCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <TopAppBar />
        <div className="flex-1 p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}
