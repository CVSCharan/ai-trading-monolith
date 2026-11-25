import { describe, expect, test } from 'bun:test';
import pino from 'pino';
import { PaperTradingEngine } from '../src/services/paper-trading';
import {
  StreamingSignalGenerator,
  type CandleResampled,
  type Instrument,
  type StrategyConfig,
} from '@groww-trading/strategy-core';

function makeISTDate(hourIST: number, minuteIST: number): Date {
  let utcHour = hourIST - 5;
  let utcMin = minuteIST - 30;
  if (utcMin < 0) {
    utcMin += 60;
    utcHour -= 1;
  }
  return new Date(Date.UTC(2024, 0, 15, utcHour, utcMin));
}

function makeMockDb() {
  const state = {
    portfolio: {
      id: 'pf-1',
      userId: 'user-1',
      initialCapital: '1000000',
      cashBalance: '1000000',
      totalValue: '1000000',
      dailyPnl: '0',
      dayStartValue: '1000000',
    },
    positions: [] as Array<Record<string, any>>,
    trades: [] as Array<Record<string, any>>,
    profile: { userId: 'user-1', riskLimits: { maxDailyLossPct: 2, maxPositions: 3 } },
  };

  const db = {
    select: () => ({
      from: (table: any) => ({
        where: () => {
          const rows =
            table === undefined
              ? []
              : String(table[Symbol.for('drizzle:Name')] ?? '').includes('portfolio')
                ? [state.portfolio]
                : String(table[Symbol.for('drizzle:Name')] ?? '').includes('profile')
                  ? [state.profile]
                  : state.positions.filter((p) => !p.closedAt);
          const chain: any = {
            limit: async () => rows.slice(0, 1),
            then: (resolve: (v: any) => void) => resolve(rows),
          };
          return chain;
        },
      }),
    }),
    insert: (table: any) => ({
      values: async (val: any) => {
        const name = String(table[Symbol.for('drizzle:Name')] ?? '');
        if (name.includes('position')) {
          state.positions.push({ id: `pos-${state.positions.length + 1}`, ...val, closedAt: null });
        } else if (name.includes('trade')) {
          state.trades.push({ id: `tr-${state.trades.length + 1}`, ...val });
        }
        return [val];
      },
    }),
    update: (table: any) => ({
      set: (vals: any) => ({
        where: async () => {
          const name = String(table[Symbol.for('drizzle:Name')] ?? '');
          if (name.includes('position') && state.positions[0]) {
            Object.assign(state.positions[0], vals);
          } else if (name.includes('portfolio')) {
            Object.assign(state.portfolio, vals);
          }
          return [];
        },
      }),
    }),
  };

  return { db, state };
}

describe('PaperTradingEngine (S4-013 & S4-014)', () => {
  const logger = pino({ level: 'silent' });
  const instruments: Instrument[] = [
    {
      id: 1,
      symbol: 'NIFTY',
      instrumentType: 'INDEX',
      lotSize: 75,
      tickSize: 0.05,
      strikeStep: 50,
      validFrom: new Date('2024-01-01'),
      validTo: null,
      growwToken: 'NIFTY-IDX',
      isActive: true,
    },
    {
      id: 2,
      symbol: 'NIFTY',
      instrumentType: 'OPT',
      underlyingSymbol: 'NIFTY',
      strikePrice: 24000,
      optionType: 'CE',
      expiryDate: new Date('2024-01-25'),
      expiryType: 'WEEKLY',
      lotSize: 75,
      tickSize: 0.05,
      strikeStep: 50,
      validFrom: new Date('2024-01-01'),
      validTo: null,
      growwToken: 'NIFTY24JAN24000CE',
      isActive: true,
    },
  ];
  const strategy: StrategyConfig = {
    id: 'strat-1',
    name: 'Test Paper',
    underlyingSymbol: 'NIFTY',
    timeframe: '15m',
    entryWindow: { start: '09:30', end: '11:30' },
    exitTime: '15:00',
    executionMode: 'ATM_BUY',
    strikeOffset: 5,
    lots: 1,
    expiryPreference: 'WEEKLY',
    avoidExpiryDays: 2,
    risk: {
      maxDailyLossPct: 2,
      maxPositions: 3,
      maxPositionsPerStrategy: 1,
      perTradeRiskPct: 1,
      blockedPeriods: ['09:15-09:30'],
      shortOptionStopLossPct: 100,
    },
  };

  test('opens paper position on signal, updates MTM, and closes on 15:00 square-off', async () => {
    const { db, state } = makeMockDb();
    const engine = new PaperTradingEngine(db, logger, {} as any, {} as any);
    const gen = new StreamingSignalGenerator(strategy, instruments, 'paper');
    gen.initializeFromHistory(100, 105, null);

    const entryBar: CandleResampled = {
      instrumentId: 1,
      timeframe: '15m',
      barTime: makeISTDate(9, 30),
      open: 24000,
      high: 24005,
      low: 23995,
      close: 24000,
      volume: 1000,
    };

    const entrySignals = await engine.onBarClose('user-1', gen, entryBar, instruments, () => 120);
    expect(entrySignals.length).toBe(1);
    expect(state.positions.length).toBe(1);
    expect(state.trades.length).toBe(1);

    // MTM tick at 140 (+20 * 75 = +1500 unrealized)
    await engine.updateMarkToMarket('user-1', new Map([['NIFTY24JAN24000CE', 140]]));
    expect(Number(state.positions[0]?.unrealizedPnl)).toBe(1500);
    expect(Number(state.portfolio.totalValue)).toBe(1001500);

    // 15:00 square-off closes position and updates cash balance
    const exitBar: CandleResampled = {
      instrumentId: 1,
      timeframe: '15m',
      barTime: makeISTDate(14, 45),
      open: 24000,
      high: 24000,
      low: 24000,
      close: 24000,
      volume: 1000,
    };
    const exitSignals = await engine.onBarClose('user-1', gen, exitBar, instruments, () => 140);
    expect(exitSignals.length).toBe(1);
    expect(state.positions[0]?.closedAt).toBeTruthy();
    expect(Number(state.portfolio.cashBalance)).toBeGreaterThan(1000000);
  });
});
