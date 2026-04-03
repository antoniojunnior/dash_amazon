import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Sapphire Alerts Loading
 * Replicador estrutural da Central de Alertas.
 */
export default function AlertsLoading() {
  return (
    <div className="flex flex-col flex-1 min-w-0 animate-in fade-in duration-500">
      
      {/* Header Skeleton */}
      <div className="flex flex-col sm:items-start mb-8 gap-1 px-1">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-full" />
      </div>

      <div className="md3-card overflow-hidden">
        <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-5 w-24 rounded-lg" />
        </div>

        <div className="divide-y divide-outline-variant/5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-8 flex items-start gap-6">
              <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-1/3 rounded-full" />
                  <Skeleton className="h-3 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-5/6 rounded-full" />
                <div className="flex gap-4 pt-2">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
