// ============================================
// EMA Implementation with Proper Seeding
// ============================================

/**
 * EMA with proper seeding for broker compatibility
 *
 * Seeding: First EMA = SMA of first `period` closes
 * Warm-up: First `period - 1` values are NaN (not usable for signals)
 * Continuity: EMAs run continuously across sessions (no daily reset)
 */

export function calculateEMA(prices: number[], period: number): (number | NaN)[] {
  if (prices.length < period) {
    return prices.map(() => NaN);
  }

  const multiplier = 2 / (period + 1);
  const ema: (number | NaN)[] = new Array(prices.length).fill(NaN);

  // Seed with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  ema[period - 1] = sum / period;

  // Calculate rest using EMA formula
  for (let i = period; i < prices.length; i++) {
    const prevEMA = ema[i - 1] as number;
    ema[i] = (prices[i] - prevEMA) * multiplier + prevEMA;
  }

  return ema;
}

export function updateEMA(prevEMA: number, currentPrice: number, period: number): number {
  const multiplier = 2 / (period + 1);
  return (currentPrice - prevEMA) * multiplier + prevEMA;
}

export function initializeEMAs(closes: number[]): { ema9: number | NaN; ema21: number | NaN; warmupComplete: boolean } {
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);

  const lastIdx = closes.length - 1;
  return {
    ema9: ema9[lastIdx],
    ema21: ema21[lastIdx],
    warmupComplete: !isNaN(ema21[lastIdx])
  };
}

export function calculateEMAsForCandles(candles: { close: number }[]): { ema9: (number | NaN)[]; ema21: (number | NaN)[] } {
  const closes = candles.map(c => c.close);
  return calculateEMA9and21(closes);
}

// Also export calculateEMA9and21 for the test
export function calculateEMA9and21(closes: number[]): { ema9: (number | NaN)[]; ema21: (number | NaN)[] } {
  if (closes.length < 21) {
    return { ema9: closes.map(() => NaN), ema21: closes.map(() => NaN) };
  }

  const ema9: (number | NaN)[] = new Array(closes.length).fill(NaN);
  const ema21: (number | NaN)[] = new Array(closes.length).fill(NaN);

  const mult9 = 2 / 10;
  const mult21 = 2 / 22;

  let sum9 = 0;
  let sum21 = 0;
  for (let i = 0; i < 21; i++) {
    sum9 += closes[i];
    sum21 += closes[i];
    if (i === 8) ema9[8] = sum9 / 9;
  }
  ema21[20] = sum21 / 21;

  for (let i = 9; i < closes.length; i++) {
    ema9[i] = (closes[i] - (ema9[i - 1] as number)) * mult9 + (ema9[i - 1] as number);
  }
  for (let i = 21; i < closes.length; i++) {
    ema21[i] = (closes[i] - (ema21[i - 1] as number)) * mult21 + (ema21[i - 1] as number);
  }

  return { ema9, ema21 };
}

export class StreamingEMA {
  private ema9: number | NaN = NaN;
  private ema21: number | NaN = NaN;
  private readonly mult9 = 2 / 10;
  private readonly mult21 = 2 / 22;
  private readonly seedBuffer: number[] = [];
  private seeded = false;

  addClose(close: number): { ema9: number | NaN; ema21: number | NaN; warmupComplete: boolean } {
    if (!this.seeded) {
      this.seedBuffer.push(close);
      if (this.seedBuffer.length >= 21) {
        let sum9 = 0, sum21 = 0;
        for (let i = 0; i < 21; i++) {
          sum9 += this.seedBuffer[i];
          sum21 += this.seedBuffer[i];
          if (i === 8) this.ema9 = sum9 / 9;
        }
        this.ema21 = sum21 / 21;
        this.seeded = true;
      }
    } else {
      this.ema9 = (close - this.ema9) * this.mult9 + this.ema9;
      this.ema21 = (close - this.ema21) * this.mult21 + this.ema21;
    }

    return { ema9: this.ema9, ema21: this.ema21, warmupComplete: this.seeded };
  }

  getState(): { ema9: number | NaN; ema21: number | NaN; warmupComplete: boolean } {
    return { ema9: this.ema9, ema21: this.ema21, warmupComplete: this.seeded };
  }

  reset(): void {
    this.ema9 = NaN;
    this.ema21 = NaN;
    this.seedBuffer.length = 0;
    this.seeded = false;
  }
}