import * as React from 'react';
import { cn } from '../../lib/utils';

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

export function Popover({
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(nextOpen);
      } else {
        setUncontrolledOpen(nextOpen);
      }
    },
    [isControlled, onOpenChange],
  );

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
  }, [open, setOpen]);

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error('PopoverTrigger must be used within Popover');

  return (
    <div
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn('inline-flex cursor-pointer', className)}
      role="button"
      aria-haspopup="dialog"
      aria-expanded={ctx.open}
    >
      {children}
    </div>
  );
}

export function PopoverContent({
  align = 'end',
  side = 'bottom',
  className,
  children,
}: {
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(PopoverContext);
  if (!ctx || !ctx.open) return null;

  const alignClasses = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  }[align];

  const sideClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
  }[side];

  return (
    <div
      className={cn(
        'absolute z-50 rounded-xl border border-slate-800 bg-slate-950/95 p-4 text-slate-200 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150',
        alignClasses,
        sideClasses,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PopoverClose({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(PopoverContext);
  return (
    <div
      onClick={() => ctx?.setOpen(false)}
      className={cn('inline-flex cursor-pointer', className)}
    >
      {children}
    </div>
  );
}
