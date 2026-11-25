import { getISTDateString } from '@groww-trading/shared';
import type { BacktestResult, BacktestTrade, DailyReturn, EquityPoint } from '../types';

export function buildEquityCurve(
  trades: BacktestTrade[],
  initialCapital: number,
  startDate: Date
): EquityPoint[] {
  const curve: EquityPoint[] = [
    { timestamp: startDate, equity: initialCapital, drawdown: 0 },
  ];

  let equity = initialCapital;
  let peak = initialCapital;

  for (const trade of trades) {
    equity += trade.netPnl ?? 0;
    if (equity > peak) peak = equity;
    const drawdown = peak > 0 ? (peak - equity) / peak : 0;
    curve.push({
      timestamp: trade.exitTime ?? trade.entryTime,
      equity,
      drawdown,
    });
  }

  return curve;
}

export function buildDailyReturns(
  trades: BacktestTrade[],
  initialCapital: number
): DailyReturn[] {
  const byDay = new Map<string, { date: Date; pnl: number; trades: number }>();

  for (const trade of trades) {
    const dt = trade.exitTime ?? trade.entryTime;
    const key = getISTDateString(dt);
    const existing = byDay.get(key);
    if (existing) {
      existing.pnl += trade.netPnl ?? 0;
      existing.trades += 1;
    } else {
      byDay.set(key, { date: dt, pnl: trade.netPnl ?? 0, trades: 1 });
    }
  }

  const dailyReturns: DailyReturn[] = [];
  let runningCapital = initialCapital;

  for (const entry of byDay.values()) {
    const ret = runningCapital > 0 ? entry.pnl / runningCapital : 0;
    runningCapital += entry.pnl;
    dailyReturns.push({
      date: entry.date,
      return: ret,
      trades: entry.trades,
    });
  }

  return dailyReturns;
}

export function formatBacktestReport(result: BacktestResult) {
  return {
    runId: result.runId,
    summary: {
      totalTrades: result.totalTrades,
      winningTrades: result.winningTrades,
      losingTrades: result.losingTrades,
      winRatePct: Number((result.winRate * 100).toFixed(2)),
      netPnl: Number(result.netPnl.toFixed(2)),
      finalCapital: Number(result.finalCapital.toFixed(2)),
      maxDrawdownPct: Number((result.maxDrawdown * 100).toFixed(2)),
      sharpeRatio: Number(result.sharpeRatio.toFixed(2)),
      sortinoRatio: Number(result.sortinoRatio.toFixed(2)),
      calmarRatio: Number(result.calmarRatio.toFixed(2)),
      profitFactor: Number.isFinite(result.profitFactor)
        ? Number(result.profitFactor.toFixed(2))
        : null,
    },
    trades: result.trades,
    equityCurve: result.equityCurve,
    dailyReturns: result.dailyReturns,
  };
}
