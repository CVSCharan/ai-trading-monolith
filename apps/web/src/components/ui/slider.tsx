import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SliderProps {
  value: number;
  onValueChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  id,
  'aria-label': ariaLabel,
}: SliderProps) {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div className={cn('relative flex w-full touch-none select-none items-center py-2', className)}>
      <div className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-sky-500 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        id={id}
        aria-label={ariaLabel}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <div
        className="pointer-events-none absolute block h-4 w-4 -translate-x-1/2 rounded-full border border-sky-400 bg-white shadow-md ring-0 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        style={{ left: `${percentage}%` }}
      />
    </div>
  );
}
