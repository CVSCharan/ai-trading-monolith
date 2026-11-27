import * as React from 'react';
import { cn } from '../../lib/utils';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  onValueChange,
  defaultValue,
  className,
  children,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [tab, setTab] = React.useState(defaultValue || '');
  const activeValue = value !== undefined ? value : tab;
  const setActiveValue = onValueChange || setTab;

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: setActiveValue }}>
      <div className={cn('flex flex-col space-y-4', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-start rounded-xl border border-slate-800 bg-slate-950/70 p-1 text-slate-400 overflow-x-auto thin-scrollbar',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  className,
  disabled,
  children,
}: {
  value: string;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error('TabsTrigger must be used inside Tabs');
  const isSelected = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      disabled={disabled}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all focus:outline-none disabled:pointer-events-none disabled:opacity-50',
        isSelected
          ? 'bg-slate-800 text-white shadow-sm font-semibold'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error('TabsContent must be used inside Tabs');
  if (ctx.value !== value) return null;

  return (
    <div role="tabpanel" className={cn('focus:outline-none animate-in fade-in-50 duration-150', className)}>
      {children}
    </div>
  );
}
