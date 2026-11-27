import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled = false,
  id,
  className,
  'aria-label': ariaLabel,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      id={id}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'peer h-4 w-4 shrink-0 rounded border border-slate-700 bg-slate-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center',
        checked ? 'bg-sky-500 border-sky-500 text-slate-950 font-bold' : 'hover:border-slate-500',
        className,
      )}
    >
      {checked && <Check className="h-3 w-3 text-slate-950 stroke-[3]" />}
    </button>
  );
}
