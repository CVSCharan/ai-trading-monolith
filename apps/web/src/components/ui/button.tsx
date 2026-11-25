import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 font-semibold',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white',
  outline: 'border border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-800',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  );
}
