import { isInEntryWindow, isSquareOffTime } from '@groww-trading/shared';
import type { CrossoverDirection, SignalType, TradeSide } from '../types';

export { isInEntryWindow };

/**
 * Detect EMA9/EMA21 crossover on closed bars.
 */
export function detectCrossover(
  ema9: number[],
  ema21: number[]
): CrossoverDirection[] {
  const result: CrossoverDirection[] = new Array(ema9.length).fill('NONE');

  for (let i = 1; i < ema9.length; i++) {
    const prev9 = ema9[i - 1];
    const prev21 = ema21[i - 1];
    const curr9 = ema9[i];
    const curr21 = ema21[i];

    if (
      prev9 === undefined ||
      prev21 === undefined ||
      curr9 === undefined ||
      curr21 === undefined ||
      isNaN(prev9) ||
      isNaN(prev21) ||
      isNaN(curr9) ||
      isNaN(curr21)
    ) {
      continue;
    }

    if (prev9 <= prev21 && curr9 > curr21) {
      result[i] = 'BULLISH';
    } else if (prev9 >= prev21 && curr9 < curr21) {
      result[i] = 'BEARISH';
    }
  }

  return result;
}

export function crossoverToSignal(direction: CrossoverDirection): SignalType | null {
  if (direction === 'BULLISH') return 'BUY';
  if (direction === 'BEARISH') return 'SELL';
  return null;
}

export function oppositeSignal(signal: SignalType): SignalType {
  return signal === 'BUY' ? 'SELL' : 'BUY';
}

export function signalToSide(signal: SignalType): TradeSide {
  return signal === 'BUY' ? 'LONG' : 'SHORT';
}

export function shouldSquareOff(time: Date, exitTime: string = '15:00'): boolean {
  return isSquareOffTime(time, exitTime);
}

export function shouldExitOnCrossover(
  currentPosition: TradeSide,
  crossover: CrossoverDirection
): boolean {
  if (currentPosition === 'LONG' && crossover === 'BEARISH') return true;
  if (currentPosition === 'SHORT' && crossover === 'BULLISH') return true;
  return false;
}

export function isReversal(
  currentPosition: TradeSide | null,
  crossover: CrossoverDirection
): boolean {
  if (!currentPosition) return false;
  return shouldExitOnCrossover(currentPosition, crossover);
}
