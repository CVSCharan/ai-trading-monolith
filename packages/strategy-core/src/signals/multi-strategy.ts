import { getISTDateString, getMinutesISTFromUTC } from '@groww-trading/shared';
import type { CandleResampled, SignalType, TradeSide } from '../types';

export type StrategyTemplateId =
  | 'EMA_9_21'
  | 'ORB_BREAKOUT'
  | 'VWAP_PULLBACK'
  | 'RSI_MEAN_REVERSION';

export type AssetClass = 'INDEX_OPTIONS' | 'EQUITY_CASH';

export interface MultiStrategySignal {
  templateId: StrategyTemplateId;
  assetClass: AssetClass;
  symbol: string;
  barTime: Date;
  action: 'ENTER' | 'EXIT';
  signalType: SignalType;
  spotPrice: number;
  reason: string;
}

/**
 * Wilder/SMA-seeded RSI calculation (zero external deps).
 */
export function calculateRSI(closes: number[], period = 14): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  if (closes.length <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    if (diff >= 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

/**
 * Session-resetting VWAP across IST trading days.
 */
export function calculateSessionVWAP(bars: CandleResampled[]): number[] {
  const out = new Array<number>(bars.length).fill(NaN);
  let currentDate = '';
  let cumPV = 0;
  let cumVol = 0;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]!;
    const dateKey = getISTDateString(b.barTime);
    if (dateKey !== currentDate) {
      currentDate = dateKey;
      cumPV = 0;
      cumVol = 0;
    }
    const typicalPrice = (b.high + b.low + b.close) / 3;
    const vol = Math.max(1, b.volume || 1);
    cumPV += typicalPrice * vol;
    cumVol += vol;
    out[i] = cumPV / cumVol;
  }

  return out;
}

/**
 * Stateful evaluator for ORB_BREAKOUT, VWAP_PULLBACK, and RSI_MEAN_REVERSION
 * supporting both INDEX_OPTIONS and EQUITY_CASH execution.
 */
export class MultiStrategyEvaluator {
  private position: TradeSide | null = null;
  private bars: CandleResampled[] = [];
  private orbDay = '';
  private orbHigh = -Infinity;
  private orbLow = Infinity;

  constructor(
    private readonly templateId: Exclude<StrategyTemplateId, 'EMA_9_21'>,
    private readonly assetClass: AssetClass,
    private readonly symbol: string,
    private readonly squareOffMinutesIST = 15 * 60
  ) {}

  processBar(bar: CandleResampled): MultiStrategySignal[] {
    this.bars.push(bar);
    const signals: MultiStrategySignal[] = [];
    const istDate = getISTDateString(bar.barTime);
    const mins = getMinutesISTFromUTC(bar.barTime);

    if (istDate !== this.orbDay) {
      this.orbDay = istDate;
      this.orbHigh = bar.high;
      this.orbLow = bar.low;
    }

    // Mandatory intraday square-off check
    if (this.position !== null && mins >= this.squareOffMinutesIST) {
      signals.push({
        templateId: this.templateId,
        assetClass: this.assetClass,
        symbol: this.symbol,
        barTime: bar.barTime,
        action: 'EXIT',
        signalType: this.position === 'LONG' ? 'SELL' : 'BUY',
        spotPrice: bar.close,
        reason: 'INTRADAY_SQUARE_OFF',
      });
      this.position = null;
      return signals;
    }

    if (this.templateId === 'ORB_BREAKOUT') {
      // First bar of session (09:15-09:30) sets the opening range
      if (mins < 9 * 60 + 30) {
        this.orbHigh = Math.max(this.orbHigh, bar.high);
        this.orbLow = Math.min(this.orbLow, bar.low);
        return signals;
      }

      if (this.position === null && mins < 14 * 60 + 30) {
        if (bar.close > this.orbHigh) {
          this.position = 'LONG';
          signals.push({
            templateId: this.templateId,
            assetClass: this.assetClass,
            symbol: this.symbol,
            barTime: bar.barTime,
            action: 'ENTER',
            signalType: 'BUY',
            spotPrice: bar.close,
            reason: `ORB_HIGH_BREAKOUT (${this.orbHigh.toFixed(2)})`,
          });
        } else if (bar.close < this.orbLow) {
          this.position = 'SHORT';
          signals.push({
            templateId: this.templateId,
            assetClass: this.assetClass,
            symbol: this.symbol,
            barTime: bar.barTime,
            action: 'ENTER',
            signalType: 'SELL',
            spotPrice: bar.close,
            reason: `ORB_LOW_BREAKDOWN (${this.orbLow.toFixed(2)})`,
          });
        }
      }
      return signals;
    }

    if (this.templateId === 'VWAP_PULLBACK') {
      const vwaps = calculateSessionVWAP(this.bars);
      const currVwap = vwaps[vwaps.length - 1]!;
      const prevBar = this.bars[this.bars.length - 2];
      if (!prevBar || Number.isNaN(currVwap)) return signals;

      if (this.position === null && mins >= 9 * 60 + 30 && mins < 14 * 60 + 30) {
        if (prevBar.low <= currVwap && bar.close > currVwap) {
          this.position = 'LONG';
          signals.push({
            templateId: this.templateId,
            assetClass: this.assetClass,
            symbol: this.symbol,
            barTime: bar.barTime,
            action: 'ENTER',
            signalType: 'BUY',
            spotPrice: bar.close,
            reason: `VWAP_BULLISH_BOUNCE (${currVwap.toFixed(2)})`,
          });
        } else if (prevBar.high >= currVwap && bar.close < currVwap) {
          this.position = 'SHORT';
          signals.push({
            templateId: this.templateId,
            assetClass: this.assetClass,
            symbol: this.symbol,
            barTime: bar.barTime,
            action: 'ENTER',
            signalType: 'SELL',
            spotPrice: bar.close,
            reason: `VWAP_BEARISH_REJECTION (${currVwap.toFixed(2)})`,
          });
        }
      } else if (this.position === 'LONG' && bar.close < currVwap) {
        this.position = null;
        signals.push({
          templateId: this.templateId,
          assetClass: this.assetClass,
          symbol: this.symbol,
          barTime: bar.barTime,
          action: 'EXIT',
          signalType: 'SELL',
          spotPrice: bar.close,
          reason: 'VWAP_LOST',
        });
      } else if (this.position === 'SHORT' && bar.close > currVwap) {
        this.position = null;
        signals.push({
          templateId: this.templateId,
          assetClass: this.assetClass,
          symbol: this.symbol,
          barTime: bar.barTime,
          action: 'EXIT',
          signalType: 'BUY',
          spotPrice: bar.close,
          reason: 'VWAP_RECLAIMED',
        });
      }
      return signals;
    }

    if (this.templateId === 'RSI_MEAN_REVERSION') {
      const rsis = calculateRSI(this.bars.map((b) => b.close), 14);
      const rsi = rsis[rsis.length - 1]!;
      if (Number.isNaN(rsi)) return signals;

      if (this.position === null && mins >= 9 * 60 + 30 && mins < 14 * 60 + 30) {
        if (rsi <= 30) {
          this.position = 'LONG';
          signals.push({
            templateId: this.templateId,
            assetClass: this.assetClass,
            symbol: this.symbol,
            barTime: bar.barTime,
            action: 'ENTER',
            signalType: 'BUY',
            spotPrice: bar.close,
            reason: `RSI_OVERSOLD (${rsi.toFixed(1)})`,
          });
        } else if (rsi >= 70) {
          this.position = 'SHORT';
          signals.push({
            templateId: this.templateId,
            assetClass: this.assetClass,
            symbol: this.symbol,
            barTime: bar.barTime,
            action: 'ENTER',
            signalType: 'SELL',
            spotPrice: bar.close,
            reason: `RSI_OVERBOUGHT (${rsi.toFixed(1)})`,
          });
        }
      } else if (this.position === 'LONG' && rsi >= 50) {
        this.position = null;
        signals.push({
          templateId: this.templateId,
          assetClass: this.assetClass,
          symbol: this.symbol,
          barTime: bar.barTime,
          action: 'EXIT',
          signalType: 'SELL',
          spotPrice: bar.close,
          reason: `RSI_MEAN_EXIT (${rsi.toFixed(1)})`,
        });
      } else if (this.position === 'SHORT' && rsi <= 50) {
        this.position = null;
        signals.push({
          templateId: this.templateId,
          assetClass: this.assetClass,
          symbol: this.symbol,
          barTime: bar.barTime,
          action: 'EXIT',
          signalType: 'BUY',
          spotPrice: bar.close,
          reason: `RSI_MEAN_EXIT (${rsi.toFixed(1)})`,
        });
      }
    }

    return signals;
  }
}
