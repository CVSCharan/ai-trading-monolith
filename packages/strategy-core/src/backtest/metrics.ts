import type { BacktestTrade, DailyReturn, EquityPoint } from '../types';

const TRADING_DAYS_PER_YEAR = 252;
const RISK_FREE_RATE = 0.065; // 6.5% India 10Y / T-bill proxy

export interface BacktestMetricsSummary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  finalCapital: number;
  netPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  profitFactor: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
}

export function calculateBacktestMetrics(
  trades: BacktestTrade[],
  equityCurve: EquityPoint[],
  dailyReturns: DailyReturn[],
  initialCapital: number
): BacktestMetricsSummary {
  const totalTrades = trades.length;
  const pnls = trades.map((t) => t.netPnl ?? 0);
  const netPnl = pnls.reduce((sum, p) => sum + p, 0);
  const finalCapital = initialCapital + netPnl;

  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const winningTrades = wins.length;
  const losingTrades = losses.length;
  const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

  const grossWins = wins.reduce((s, p) => s + p, 0);
  const grossLossesAbs = Math.abs(losses.reduce((s, p) => s + p, 0));
  const profitFactor =
    grossLossesAbs > 0 ? grossWins / grossLossesAbs : grossWins > 0 ? Infinity : 0;

  const avgWin = winningTrades > 0 ? grossWins / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? grossLossesAbs / losingTrades : 0;

  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const p of pnls) {
    if (p > 0) {
      curWin++;
      curLoss = 0;
      if (curWin > maxConsecutiveWins) maxConsecutiveWins = curWin;
    } else if (p < 0) {
      curLoss++;
      curWin = 0;
      if (curLoss > maxConsecutiveLosses) maxConsecutiveLosses = curLoss;
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }

  let maxDrawdown = 0;
  for (const pt of equityCurve) {
    if (pt.drawdown > maxDrawdown) maxDrawdown = pt.drawdown;
  }

  const rets = dailyReturns.map((d) => d.return);
  const sharpeRatio = computeSharpe(rets);
  const sortinoRatio = computeSortino(rets);

  const totalReturn = initialCapital > 0 ? netPnl / initialCapital : 0;
  const annualizedReturn =
    rets.length > 0 ? totalReturn * (TRADING_DAYS_PER_YEAR / rets.length) : 0;
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    finalCapital,
    netPnl,
    maxDrawdown,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    profitFactor,
    winRate,
    avgWin,
    avgLoss,
    maxConsecutiveWins,
    maxConsecutiveLosses,
  };
}

function computeSharpe(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const dailyRf = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;
  const excess = dailyReturns.map((r) => r - dailyRf);
  const mean = excess.reduce((s, r) => s + r, 0) / excess.length;
  const variance =
    excess.reduce((s, r) => s + (r - mean) ** 2, 0) / (excess.length - 1);
  const std = Math.sqrt(variance);
  return std > 0 ? (mean / std) * Math.sqrt(TRADING_DAYS_PER_YEAR) : 0;
}

function computeSortino(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const dailyRf = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;
  const excess = dailyReturns.map((r) => r - dailyRf);
  const mean = excess.reduce((s, r) => s + r, 0) / excess.length;
  const downsideSq = excess.map((r) => (r < 0 ? r ** 2 : 0));
  const downsideVar =
    downsideSq.reduce((s, v) => s + v, 0) / (excess.length - 1);
  const downsideDev = Math.sqrt(downsideVar);
  return downsideDev > 0
    ? (mean / downsideDev) * Math.sqrt(TRADING_DAYS_PER_YEAR)
    : 0;
}
