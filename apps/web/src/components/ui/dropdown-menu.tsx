import * as React from 'react';
import { cn } from '../../lib/utils';

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
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
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({ asChild, children, className }: { asChild?: boolean; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error('DropdownMenuTrigger must be inside DropdownMenu');

  return (
    <div onClick={() => ctx.setOpen(!ctx.open)} className={cn('cursor-pointer inline-flex', className)}>
      {children}
    </div>
  );
}

export function DropdownMenuContent({
  align = 'end',
  className,
  children,
}: {
  align?: 'start' | 'end' | 'center';
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx || !ctx.open) return null;

  const alignClasses = {
    start: 'left-0',
    end: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  }[align];

  return (
    <div
      className={cn(
        'absolute z-50 mt-2 min-w-[8rem] rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 text-slate-200 shadow-2xl backdrop-blur-xl animate-in fade-in-80 zoom-in-95 duration-100',
        alignClasses,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  onClick,
  disabled,
  className,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(DropdownMenuContext);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onClick?.();
        ctx?.setOpen(false);
      }}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none transition-colors hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn('-mx-1 my-1 h-px bg-slate-800', className)} />;
}

export function DropdownMenuLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('px-2.5 py-1.5 text-[11px] font-semibold text-slate-400', className)}>{children}</div>;
}
