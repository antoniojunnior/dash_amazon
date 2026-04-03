import React from 'react';
import { Skeleton, TableRowSkeleton } from '@/components/ui/Skeleton';

/**
 * Sapphire Orders Loading
 * Replicador estrutural da página de Pedidos.
 */
export default function OrdersLoading() {
  return (
    <div className="flex flex-col flex-1 min-w-0 animate-in fade-in duration-500">
      
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 px-1">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </div>

      {/* Toolbar Skeleton */}
      <div className="md3-card mb-6 p-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-surface-container-low/40">
        <div className="flex gap-2 items-center flex-1 w-full max-w-md">
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="md3-card overflow-hidden">
        <div className="bg-surface-container-high/30 h-14 flex items-center px-6 border-b border-outline-variant/10">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={`h-3 rounded-full ${i === 0 ? 'w-32' : 'w-20'} mx-auto`} />
          ))}
        </div>
        <div className="divide-y divide-outline-variant/5">
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRowSkeleton key={i} columns={5} />
          ))}
        </div>
      </div>
    </div>
  );
}
