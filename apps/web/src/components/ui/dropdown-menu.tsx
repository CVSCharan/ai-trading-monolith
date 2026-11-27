import * as React from 'react';
import { Check, Circle } from 'lucide-react';
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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
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

export function DropdownMenuTrigger({
  asChild,
  children,
  className,
}: {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error('DropdownMenuTrigger must be inside DropdownMenu');

  return (
    <div
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn('cursor-pointer inline-flex', className)}
      role="button"
      aria-haspopup="menu"
      aria-expanded={ctx.open}
    >
      {children}
    </div>
  );
}

export function DropdownMenuGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('py-1', className)}>{children}</div>;
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
      role="menu"
      aria-orientation="vertical"
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
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onClick?.();
        ctx?.setOpen(false);
      }}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors hover:bg-slate-800 focus:bg-slate-800 focus:outline-none disabled:pointer-events-none disabled:opacity-50 text-slate-200 hover:text-white',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  disabled,
  className,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(DropdownMenuContext);
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onCheckedChange(!checked);
        ctx?.setOpen(false);
      }}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors hover:bg-slate-800 focus:bg-slate-800 focus:outline-none disabled:pointer-events-none disabled:opacity-50 text-slate-200',
        className,
      )}
    >
      <span>{children}</span>
      {checked && <Check className="h-3.5 w-3.5 text-sky-400" />}
    </button>
  );
}

export function DropdownMenuRadioItem({
  checked,
  onClick,
  disabled,
  className,
  children,
}: {
  checked: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(DropdownMenuContext);
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onClick?.();
        ctx?.setOpen(false);
      }}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors hover:bg-slate-800 focus:bg-slate-800 focus:outline-none disabled:pointer-events-none disabled:opacity-50 text-slate-200',
        className,
      )}
    >
      <span>{children}</span>
      {checked && <Circle className="h-2 w-2 fill-sky-400 text-sky-400" />}
    </button>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn('-mx-1 my-1 h-px bg-slate-800', className)} role="separator" />;
}

export function DropdownMenuLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('px-2.5 py-1 text-xs font-semibold text-slate-400', className)}>{children}</div>;
}

export function DropdownMenuShortcut({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn('ml-auto text-[10px] tracking-widest text-slate-500 font-mono', className)}>{children}</span>;
}
