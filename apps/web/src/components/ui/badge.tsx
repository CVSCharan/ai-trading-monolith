import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'outline';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'border-slate-700 bg-slate-800 text-slate-200',
  success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  danger: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  warning: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  info: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
  outline: 'border-slate-700 bg-transparent text-slate-300',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide',
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
