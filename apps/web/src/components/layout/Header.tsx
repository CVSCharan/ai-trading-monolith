import { useQuery } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/badge';

interface HealthResponse {
  status: string;
  db: string;
  timestamp: string;
}

interface UpstoxStatusQuick {
  activeDataBroker?: string;
  activeExecutionBroker?: string;
}

export function Header({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { isDemo } = useAuth();

  const { data: health } = useQuery<HealthResponse>({
    queryKey: ['api-health'],
    queryFn: async () => {
      const res = await fetch('/health');
      if (!res.ok) throw new Error('API unreachable');
      return res.json();
    },
    refetchInterval: 10_000,
    retry: false,
  });

  const { data: broker } = useQuery<UpstoxStatusQuick>({
    queryKey: ['upstox-status'],
    queryFn: async () => {
      const res = await fetch('/api/upstox/status', { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
  });

  return (
    <header className="h-14 shrink-0 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open menu"
          className="lg:hidden rounded-lg p-1.5 text-slate-300 hover:bg-slate-800"
        >
          <Menu className="h-4 w-4" />
        </button>

        <span
          className={`h-2 w-2 rounded-full ${
            health?.status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
        />
        <span>
          API: {health?.status === 'ok' ? 'Online' : 'Offline'} · DB: {health?.db ?? '—'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isDemo && (
          <Badge variant="warning" className="animate-pulse">
            DEMO MODE
          </Badge>
        )}
        <Badge variant="info" className="hidden sm:inline-flex uppercase">
          DATA: {broker?.activeDataBroker ?? 'groww'}
        </Badge>
        <Badge variant="info" className="hidden md:inline-flex uppercase">
          EXEC: {broker?.activeExecutionBroker ?? 'groww'}
        </Badge>
        <Badge variant="warning">PAPER DEFAULT</Badge>
        <Badge variant="info" className="hidden sm:inline-flex">
          IST (UTC+5:30)
        </Badge>
      </div>
    </header>
  );
}
