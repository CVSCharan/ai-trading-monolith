import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Layers,
  LineChart,
  Lock,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  TrendingUp,
  User,
} from 'lucide-react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { OptionChainPage } from './pages/OptionChainPage';
import { StrategyBuilderPage } from './pages/StrategyBuilderPage';
import { BacktestResultsPage } from './pages/BacktestResultsPage';
import { TradeAuditorPage } from './pages/TradeAuditorPage';
import { PaperTradingPage } from './pages/PaperTradingPage';
import { LiveTradingPage } from './pages/LiveTradingPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { Badge } from './components/ui/badge';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';

interface HealthResponse {
  status: string;
  db: string;
  timestamp: string;
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Activity, demoAllowed: true },
  { to: '/option-chain', label: 'Option Chain', icon: Layers, demoAllowed: true },
  { to: '/strategy/builder', label: 'Strategy Builder', icon: LineChart, demoAllowed: true },
  { to: '/backtest', label: 'Backtests', icon: BarChart3, demoAllowed: true },
  { to: '/trade-auditor', label: 'Trade Auditor', icon: TrendingUp, demoAllowed: true },
  { to: '/paper-trading', label: 'Paper Trading', icon: Activity, demoAllowed: true },
  { to: '/live-trading', label: 'Live Trading', icon: ShieldAlert, demoAllowed: false },
  { to: '/settings', label: 'Settings', icon: Settings, demoAllowed: false },
];

function AppShell() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, isDemo, logout } = useAuth();

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside
        className={`border-r border-slate-800/90 bg-slate-900/70 transition-all duration-200 flex flex-col ${
          sidebarCollapsed ? 'w-16 p-2' : 'w-64 p-4'
        }`}
      >
        <div className="flex items-center justify-between gap-2 pb-5">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <img src="/logo.svg" alt="AI Trader" className="h-8 w-8 shrink-0 rounded-lg" />
            {!sidebarCollapsed && (
              <div className="truncate">
                <div className="text-sm font-bold tracking-tight text-white">AI Trader</div>
                <div className="text-[11px] text-slate-400">Groww Options Desk</div>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-1 flex-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, demoAllowed }) => {
            const active =
              to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
            const locked = isDemo && !demoAllowed;
            return (
              <Link
                key={to}
                to={locked ? '#' : to}
                onClick={locked ? (e) => e.preventDefault() : undefined}
                title={locked ? `${label} — SUPER_ADMIN only` : label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  locked
                    ? 'text-slate-600 cursor-not-allowed border border-transparent'
                    : active
                    ? 'bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="flex-1 truncate">{label}</span>
                )}
                {!sidebarCollapsed && locked && <Lock className="h-3 w-3 text-slate-600" />}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        {!sidebarCollapsed && user && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-[11px]">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-3 w-3 text-slate-400" />
              <span className="text-slate-300 truncate">{user.email}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-1.5 text-slate-500 hover:text-red-400 transition"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </div>
        )}

        {!sidebarCollapsed && (
          <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-[11px] text-slate-400">
            <div className="font-medium text-slate-200">9/21 EMA Options</div>
            <div className="mt-0.5">15:00 IST Square-Off Active</div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-800/90 bg-slate-950/90 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span
              className={`h-2 w-2 rounded-full ${
                health?.status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span>
              API: {health?.status === 'ok' ? 'Online' : 'Offline'} · DB: {health?.db ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && (
              <Badge variant="warning" className="animate-pulse">
                DEMO MODE
              </Badge>
            )}
            <Badge variant="warning">PAPER DEFAULT</Badge>
            <Badge variant="info">IST (UTC+5:30)</Badge>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/option-chain" element={<OptionChainPage />} />
            <Route path="/strategy/builder" element={<StrategyBuilderPage />} />
            <Route path="/backtest" element={<BacktestResultsPage />} />
            <Route path="/trade-auditor" element={<TradeAuditorPage />} />
            <Route path="/trade-auditor/:id" element={<TradeAuditorPage />} />
            <Route path="/paper-trading" element={<PaperTradingPage />} />
            <Route path="/live-trading" element={<LiveTradingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected shell */}
        <Route
          path="/*"
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
