import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Standard Styled HTML Select (Backwards-compatible drop-in)
 */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-lg border border-slate-700/90 bg-slate-950/90 px-3 py-1.5 text-sm text-white transition-colors focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

/**
 * Compound Custom Select for Rich Popover-based Dropdowns
 */
interface CustomSelectContextValue {
  value: string;
  onValueChange: (val: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CustomSelectContext = React.createContext<CustomSelectContextValue | null>(null);

export function CustomSelect({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <CustomSelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div ref={containerRef} className="relative w-full">
        {children}
      </div>
    </CustomSelectContext.Provider>
  );
}

export function SelectTrigger({
  className,
  children,
  disabled,
}: {
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const ctx = React.useContext(CustomSelectContext);
  if (!ctx) throw new Error('SelectTrigger must be within CustomSelect');

  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={ctx.open}
      disabled={disabled}
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        'flex h-9 w-full items-center justify-between rounded-lg border border-slate-700/90 bg-slate-950/90 px-3 py-1.5 text-sm text-white transition-colors focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <span className="truncate">{children}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 opacity-60" />
    </button>
  );
}

export function SelectContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(CustomSelectContext);
  if (!ctx || !ctx.open) return null;

  return (
    <div
      className={cn(
        'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-800 bg-slate-900/95 p-1 text-slate-200 shadow-2xl backdrop-blur-xl animate-in fade-in-80 zoom-in-95 duration-100',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SelectItem({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(CustomSelectContext);
  if (!ctx) throw new Error('SelectItem must be within CustomSelect');
  const isSelected = ctx.value === value;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => {
        ctx.onValueChange(value);
        ctx.setOpen(false);
      }}
      className={cn(
        'flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 hover:text-white transition-colors',
        isSelected && 'bg-sky-500/10 font-medium text-sky-400',
        className,
      )}
    >
      <span>{children}</span>
      {isSelected && <Check className="h-3.5 w-3.5 text-sky-400" />}
    </div>
  );
}

export function SelectLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('px-2.5 py-1 text-xs font-semibold text-slate-400', className)}>{children}</div>;
}

export function SelectSeparator({ className }: { className?: string }) {
  return <div className={cn('-mx-1 my-1 h-px bg-slate-800', className)} />;
}
