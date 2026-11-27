import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'default' | 'lg';
  id?: string;
  name?: string;
  className?: string;
  'aria-label'?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  size = 'default',
  id,
  name,
  className,
  'aria-label': ariaLabel,
}: SwitchProps) {
  const sizeClasses = {
    sm: 'h-4 w-7',
    default: 'h-5 w-9',
    lg: 'h-6 w-11',
  }[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      id={id}
      name={name}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (!disabled) onCheckedChange(!checked);
        }
      }}
      className={cn(
        'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50',
        sizeClasses,
        checked ? 'bg-sky-500' : 'bg-slate-800',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform',
          size === 'sm' && (checked ? 'h-3 w-3 translate-x-3' : 'h-3 w-3 translate-x-0'),
          size === 'default' && (checked ? 'h-4 w-4 translate-x-4' : 'h-4 w-4 translate-x-0'),
          size === 'lg' && (checked ? 'h-5 w-5 translate-x-5' : 'h-5 w-5 translate-x-0'),
        )}
      />
    </button>
  );
}
