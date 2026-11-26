import * as React from 'react';
import { cn } from '../../lib/utils';

const VARIANT_CLASSES: Record<'info' | 'warning' | 'danger' | 'success', string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  danger: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
};

export function Alert({
  variant = 'info',
  className,
  children,
}: {
  variant?: 'info' | 'warning' | 'danger' | 'success';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-xl border px-4 py-2.5 text-sm', VARIANT_CLASSES[variant], className)}>
      {children}
    </div>
  );
}
