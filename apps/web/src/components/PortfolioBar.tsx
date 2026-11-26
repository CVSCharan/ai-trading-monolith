import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';

export interface PortfolioBarProps {
  capital: number;
  dayPnl: number;
  winRatePct: number | null;
  profitFactor: number | null;
  paperTradeCount: number;
  mode: 'PAPER' | 'LIVE';
}

export function PortfolioBar({
  capital,
  dayPnl,
  winRatePct,
  profitFactor,
  paperTradeCount,
  mode,
}: PortfolioBarProps) {
  const isPositive = dayPnl >= 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Available Capital</span>
            <Badge variant={mode === 'LIVE' ? 'danger' : 'warning'}>{mode}</Badge>
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
            ₹{capital.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-slate-500">9/21 EMA Options Desk</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-slate-400">Today&apos;s Realized + MTM P&amp;L</div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              isPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isPositive ? '+' : ''}₹{dayPnl.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Daily loss guardrail: 1.5% max</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-slate-400">Win Rate &amp; Profit Factor</div>
          <div className="mt-2 flex items-baseline gap-2 font-mono text-2xl font-semibold tabular-nums text-white">
            <span>{winRatePct === null ? '—' : `${winRatePct.toFixed(1)}%`}</span>
            <span className="text-sm text-sky-400">PF {profitFactor === null ? '—' : profitFactor.toFixed(2)}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">Based on the latest history window; see Live Trading for gate metrics</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-slate-400">Recent Closed Paper Trades</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">{paperTradeCount}</div>
          <div className="mt-1 text-xs text-slate-500">Loaded history window; check Live Trading for current gate status.</div>
        </CardContent>
      </Card>
    </div>
  );
}
