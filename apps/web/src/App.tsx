import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, LineChart, Settings, ShieldAlert, TrendingUp } from 'lucide-react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';

interface HealthResponse {
  status: string;
  db: string;
  timestamp: string;
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Activity },
  { to: '/strategy/builder', label: 'Strategy Builder', icon: LineChart },
  { to: '/backtest', label: 'Backtests', icon: BarChart3 },
  { to: '/trade-auditor', label: 'Trade Auditor', icon: TrendingUp },
  { to: '/paper-trading', label: 'Paper Trading', icon: Activity },
  { to: '/live-trading', label: 'Live Trading (Gated)', icon: ShieldAlert },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function DashboardView({ health }: { health?: HealthResponse }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Trading System Overview</h2>
        <p className="text-sm text-slate-400">
          9/21 EMA Crossover Options Platform · IST (Asia/Kolkata)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-xs uppercase tracking-wider text-slate-400">API Status</div>
          <div className="mt-2 flex items-center gap-2 text-lg font-medium text-emerald-400">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            {health?.status === 'ok' ? 'Connected' : 'Checking...'}
          </div>
          <div className="mt-1 text-xs text-slate-500">DB: {health?.db ?? '—'}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-xs uppercase tracking-wider text-slate-400">Execution Mode</div>
          <div className="mt-2 text-lg font-medium text-amber-400">PAPER DEFAULT</div>
          <div className="mt-1 text-xs text-slate-500">Live trading gated (≥100 paper trades)</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-xs uppercase tracking-wider text-slate-400">Strategy Core</div>
          <div className="mt-2 text-lg font-medium text-sky-400">9 / 21 EMA</div>
          <div className="mt-1 text-xs text-slate-500">15:00 IST unconditional square-off</div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const { data: health } = useQuery<HealthResponse>({
    queryKey: ['api-health'],
    queryFn: async () => {
      const res = await fetch('/health');
      if (!res.ok) throw new Error('Health check failed');
      return res.json();
    },
    refetchInterval: 10_000,
  });

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-6 px-2">
          <div className="text-lg font-bold tracking-tight text-white">Groww AI Trading</div>
          <div className="text-xs text-slate-400">Algorithmic Options Engine</div>
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-sky-500/15 text-sky-400 font-medium'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <Routes>
          <Route path="/" element={<DashboardView health={health} />} />
          <Route
            path="/strategy/builder"
            element={<PlaceholderView title="Strategy Builder" description="Configure NIFTY/BANKNIFTY 9/21 EMA parameters, entry windows, and risk limits." />}
          />
          <Route
            path="/backtest"
            element={<PlaceholderView title="Backtest Results" description="Enqueue and inspect deterministic historical backtests." />}
          />
          <Route
            path="/trade-auditor"
            element={<PlaceholderView title="Trade Auditor" description="Inspect 1m candlestick charts with EMA9/EMA21 overlays and option chain context." />}
          />
          <Route
            path="/paper-trading"
            element={<PlaceholderView title="Paper Trading" description="Monitor simulated positions, daily P&L, and live signals." />}
          />
          <Route
            path="/live-trading"
            element={<PlaceholderView title="Live Trading (Gated)" description="Requires 100+ paper trades, PF > 1.5, DD < 10%, and 2FA approval." />}
          />
          <Route
            path="/settings"
            element={<PlaceholderView title="Settings" description="Connect Groww TOTP Token + QR Secret and manage risk limits." />}
          />
        </Routes>
      </main>
    </div>
  );
}
