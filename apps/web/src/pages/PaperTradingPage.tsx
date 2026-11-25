import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';

export function PaperTradingPage() {
  const { connected, events } = useWebSocket(['ticks', 'signals', 'paper_updates']);

  const { data: portfolioData } = useQuery<{ portfolio: Record<string, any> | null }>({
    queryKey: ['paper-portfolio'],
    refetchInterval: 5_000,
    queryFn: async () => {
      const res = await fetch('/api/paper/portfolio', { credentials: 'include' });
      if (!res.ok) return { portfolio: null };
      return res.json();
    },
  });

  const { data: positionsData } = useQuery<{ positions: Array<Record<string, any>> }>({
    queryKey: ['paper-positions'],
    refetchInterval: 5_000,
    queryFn: async () => {
      const res = await fetch('/api/paper/positions', { credentials: 'include' });
      if (!res.ok) return { positions: [] };
      return res.json();
    },
  });

  const portfolio = portfolioData?.portfolio;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Paper Trading</h2>
        <span className={`rounded-full px-3 py-1 text-xs ${connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
          WS: {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400">Total Value</div>
          <div className="mt-1 text-xl font-semibold text-white">
            ₹{Number(portfolio?.totalValue ?? 1_000_000).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400">Cash Balance</div>
          <div className="mt-1 text-xl font-semibold text-slate-200">
            ₹{Number(portfolio?.cashBalance ?? 1_000_000).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400">Daily P&amp;L</div>
          <div className={`mt-1 text-xl font-semibold ${Number(portfolio?.dailyPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ₹{Number(portfolio?.dailyPnl ?? 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="mb-3 font-semibold text-white">Open Positions</h3>
          {(positionsData?.positions ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No open paper positions.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {positionsData?.positions.map((p) => (
                <div key={p.id} className="flex justify-between rounded-lg border border-slate-800 px-3 py-2">
                  <span>{p.optionSymbol} ({p.side} · {p.quantity})</span>
                  <span className={Number(p.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    ₹{Number(p.unrealizedPnl ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="mb-3 font-semibold text-white">Live Signal &amp; Tick Feed</h3>
          {events.length === 0 ? (
            <p className="text-sm text-slate-400">Waiting for live events on /api/market/ws...</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto text-xs">
              {events.map((ev, idx) => (
                <div key={idx} className="rounded border border-slate-800 bg-slate-950 p-2 text-slate-300">
                  <span className="font-semibold text-sky-400">[{ev.channel}]</span> {JSON.stringify(ev.data)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
