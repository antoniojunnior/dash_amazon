import React from 'react';
import { Skeleton, CardSkeleton, TableRowSkeleton } from '@/components/ui/Skeleton';

/**
 * Sapphire Inventory Loading
 * Replicador estrutural da página de Estoque.
 */
export default function InventoryLoading() {
  return (
    <div className="flex flex-col flex-1 min-w-0 animate-in fade-in duration-500">
      
      {/* Header Skeleton */}
      <div className="flex flex-col sm:items-start mb-8 gap-1 px-1">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-full" />
      </div>

      <div className="space-y-8 w-full pb-10">
        
        {/* Inventory KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* Toolbar Skeleton */}
        <div className="md3-card mb-6 p-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-surface-container-low/40">
          <Skeleton className="h-10 w-full max-w-md rounded-xl" />
          <div className="flex gap-3">
             <Skeleton className="h-10 w-28 rounded-xl" />
             <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="md3-card overflow-hidden">
          <div className="bg-surface-container-high/30 h-14 flex items-center px-6 border-b border-outline-variant/10">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={`h-3 rounded-full ${i === 0 ? 'w-48' : 'w-20'} mx-auto`} />
            ))}
          </div>
          <div className="divide-y divide-outline-variant/5">
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRowSkeleton key={i} columns={6} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
