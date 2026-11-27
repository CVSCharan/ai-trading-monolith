import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    if (open) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
          onClick={() => onOpenChange(false)}
        />
        {children}
      </div>
    </SheetContext.Provider>
  );
}

export function SheetContent({
  side = 'right',
  className,
  children,
  onClose,
}: {
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const ctx = React.useContext(SheetContext);
  const handleClose = onClose || (() => ctx?.onOpenChange(false));

  const sideClasses = {
    top: 'inset-x-0 top-0 border-b max-h-[80vh] animate-in slide-in-from-top duration-200',
    bottom: 'inset-x-0 bottom-0 border-t max-h-[80vh] animate-in slide-in-from-bottom duration-200',
    left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r animate-in slide-in-from-left duration-200',
    right: 'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l animate-in slide-in-from-right duration-200',
  }[side];

  return (
    <div
      className={cn(
        'relative z-50 flex flex-col border-slate-800 bg-slate-950 p-6 shadow-2xl overflow-y-auto',
        sideClasses,
        className,
      )}
    >
      <button
        type="button"
        onClick={handleClose}
        className="absolute right-4 top-4 rounded-sm text-slate-400 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
      {children}
    </div>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-2 text-left mb-4', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-white', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-slate-400', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-auto flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-slate-800', className)} {...props} />;
}
