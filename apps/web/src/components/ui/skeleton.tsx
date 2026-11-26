import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-slate-800/70 relative overflow-hidden',
        className
      )}
      {...props}
    />
  );
}

export function SkeletonText({ className }: { className?: string }) {
  return <Skeleton className={cn('h-4 w-full rounded', className)} />;
}

export function SkeletonMetricCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn('w-full space-y-3', className)}>
      <div className="flex gap-4 border-b border-slate-800/80 pb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 items-center py-1">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn(
                  'h-4 flex-1',
                  c === 0 ? 'w-1/4' : c === cols - 1 ? 'w-1/6' : ''
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart({
  height = 'h-64',
  className,
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div className={cn('w-full rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4', height, className)}>
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="flex items-end gap-2 h-40 pt-4">
        {Array.from({ length: 16 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${20 + ((i * 37) % 65)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonMarketGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-14" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
