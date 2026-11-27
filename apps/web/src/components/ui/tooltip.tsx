import * as React from 'react';
import { cn } from '../../lib/utils';

export function Tooltip({
  content,
  children,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 whitespace-nowrap rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 py-1 text-xs text-slate-100 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 pointer-events-none',
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
