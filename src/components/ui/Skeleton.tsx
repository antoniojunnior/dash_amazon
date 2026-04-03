import React from 'react';

/**
 * Sapphire Skeleton Component
 * Componente base para estados de carregamento progressivo e elegantes.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-on-surface-variant/10 ${className}`}
      {...props}
    />
  );
}

/**
 * Variante: Card KPI Skeleton
 */
export function CardSkeleton() {
  return (
    <div className="md3-card h-[140px] p-6 flex flex-col justify-between">
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-5 w-5 rounded-lg" />
      </div>
      <div className="mt-4 space-y-3">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-2 w-20 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Variante: Table Row Skeleton
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-4 px-6 border-b border-outline-variant/10">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 rounded-full ${i === 0 ? 'flex-[2]' : 'flex-1'}`} 
        />
      ))}
    </div>
  );
}
