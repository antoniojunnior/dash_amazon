import React from 'react';
import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton';

/**
 * Sapphire Dashboard Loading
 * Replicador estrutural do Dashboard para carregamento progressivo.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col flex-1 min-w-0 animate-in fade-in duration-500">
      
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 px-1">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-full" />
        </div>
        <Skeleton className="h-12 w-48 rounded-xl shadow-sm" />
      </div>

      <div className="space-y-8 w-full pb-10">
        
        {/* KPI Grid Skeletons */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </section>

        {/* Main Content Grid Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Chart Skeleton */}
          <div className="lg:col-span-8 md3-card p-8 flex flex-col h-[400px]">
            <div className="flex justify-between items-start mb-10">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48 rounded-lg" />
                <Skeleton className="h-3 w-64 rounded-full" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-3 w-16 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>
            </div>
            <div className="flex-1 flex items-end gap-2 px-2 pb-8">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton 
                  key={i} 
                  className="flex-1 rounded-t-lg" 
                  style={{ height: `${Math.random() * 60 + 20}%` }} 
                />
              ))}
            </div>
            <div className="flex justify-between px-2 pt-4 border-t border-outline-variant/10">
               {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-2 w-8 rounded-full" />
               ))}
            </div>
          </div>

          {/* Inbox Skeleton */}
          <div className="lg:col-span-4 md3-card flex flex-col">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center">
              <Skeleton className="h-6 w-32 rounded-lg" />
              <Skeleton className="h-5 w-16 rounded-lg" />
            </div>
            <div className="flex-1 p-6 space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4 rounded-full" />
                    <Skeleton className="h-3 w-full rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
