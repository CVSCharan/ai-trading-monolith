import { RefreshCw } from 'lucide-react';
import { Alert } from './alert';
import { Button } from './button';

export function QueryErrorState({
  error,
  onRetry,
  title = 'Could not load this data',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.';

  return (
    <div role="alert">
      <Alert variant="danger" className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="mt-1 break-words text-xs opacity-80">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </Alert>
    </div>
  );
}
