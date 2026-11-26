import {
  Activity,
  BarChart3,
  Bot,
  Layers,
  LineChart,
  Lock,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  ShieldAlert,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Activity, demoAllowed: true },
  { to: '/bot', label: 'Bot Control', icon: Bot, demoAllowed: true },
  { to: '/option-chain', label: 'Option Chain', icon: Layers, demoAllowed: true },
  { to: '/strategy/builder', label: 'Strategy Builder', icon: LineChart, demoAllowed: true },
  { to: '/backtest', label: 'Backtests', icon: BarChart3, demoAllowed: true },
  { to: '/trade-auditor', label: 'Trade Auditor', icon: TrendingUp, demoAllowed: true },
  { to: '/paper-trading', label: 'Paper Trading', icon: Activity, demoAllowed: true },
  { to: '/live-trading', label: 'Live Trading', icon: ShieldAlert, demoAllowed: false },
  { to: '/audit-logs', label: 'Audit Trail', icon: ScrollText, demoAllowed: true },
  { to: '/settings', label: 'Settings', icon: Settings, demoAllowed: false },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const location = useLocation();
  const { user, isDemo, logout } = useAuth();

  const content = (
    <aside
      className={cn(
        'h-full flex flex-col shrink-0 rounded-2xl border border-slate-800/80 bg-slate-900/75 backdrop-blur-xl shadow-2xl transition-all duration-200',
        collapsed ? 'w-16 p-2.5' : 'w-64 p-4',
      )}
    >
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-800/70">
        <Link to="/" onClick={onCloseMobile} className="flex items-center gap-2.5 overflow-hidden">
          <img src="/logo.svg" alt="AI Trader" className="h-8 w-8 shrink-0 rounded-lg" />
          {!collapsed && (
            <div className="truncate">
              <div className="text-sm font-bold tracking-tight text-white">AI Trader</div>
              <div className="text-[11px] text-slate-400">Groww + Upstox Desk</div>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Toggle sidebar"
          className="hidden lg:inline-flex rounded-lg p-1.5 text-slate-400 hover:bg-slate-800/80 hover:text-white transition-colors"
        >
          <Menu className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-800/80 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="mt-3 space-y-1 flex-1 overflow-y-auto thin-scrollbar pr-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, demoAllowed }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          const locked = isDemo && !demoAllowed;
          return (
            <Link
              key={to}
              to={locked ? '#' : to}
              onClick={(e) => {
                if (locked) {
                  e.preventDefault();
                } else {
                  onCloseMobile();
                }
              }}
              title={locked ? `${label} — SUPER_ADMIN only` : label}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors border',
                locked
                  ? 'text-slate-600 cursor-not-allowed border-transparent'
                  : active
                  ? 'bg-emerald-500/15 text-emerald-300 font-medium border-emerald-500/30 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border-transparent',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
              {!collapsed && locked && <Lock className="h-3 w-3 text-slate-600" />}
            </Link>
          );
        })}
      </nav>

      {!collapsed && user && (
        <div className="mt-3 rounded-xl border border-slate-800/90 bg-slate-950/70 p-3 text-[11px]">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-300 truncate">{user.email}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-1.5 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="mt-2 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2.5 text-[11px] text-slate-400">
          <div className="font-medium text-slate-200">9/21 EMA Options</div>
          <div className="mt-0.5">15:00 IST Square-Off Active</div>
        </div>
      )}
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block h-full shrink-0">{content}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden p-3 bg-slate-950/70 backdrop-blur-sm">
          <div className="h-full">{content}</div>
          <div className="flex-1" onClick={onCloseMobile} />
        </div>
      )}
    </>
  );
}
