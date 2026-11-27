import * as React from 'react';
import { cn } from '../../lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Avatar({ className, children, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        'relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-800 bg-slate-900',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AvatarImage({
  src,
  alt = 'Avatar',
  className,
}: {
  src?: string;
  alt?: string;
  className?: string;
}) {
  const [error, setError] = React.useState(false);
  if (!src || error) return null;

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className={cn('aspect-square h-full w-full object-cover', className)}
    />
  );
}

export function AvatarFallback({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-slate-800 text-xs font-medium text-slate-200 uppercase',
        className,
      )}
    >
      {children}
    </div>
  );
}
