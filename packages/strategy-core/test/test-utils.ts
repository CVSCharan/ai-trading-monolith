// ============================================
// Test Utilities - Shared across test files
// ============================================

import { CandleResampled, Instrument, StrategyConfig, Timeframe } from '../src/types';

export const createUTCForIST = (year: number, month: number, day: number, hourIST: number, minuteIST: number): Date => {
  const utcHour = hourIST - 5;
  const utcMin = minuteIST - 30;
  let finalHour = utcHour;
  let finalMin = utcMin;
  if (finalMin < 0) {
    finalMin += 60;
    finalHour -= 1;
  }
  if (finalHour < 0) {
    finalHour += 24;
  }
  return new Date(Date.UTC(year, month - 1, day, finalHour, finalMin));
};

export const createStrategyConfig = (overrides: Partial<StrategyConfig> = {}): StrategyConfig => ({
  id: 'test-strategy',
  name: 'Test Strategy',
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
    blockedPeriods: ['09:15-09:30', '15:15-15:30'],
    shortOptionStopLossPct: 100,
  },
  ...overrides,
};

export const createInstruments = (): Instrument[] => [
  { id: 1, symbol: 'NIFTY', instrumentType: 'INDEX', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY-IDX', isActive: true },
  { id: 2, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000CE', isActive: true },
  { id: 3, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000PE', isActive: true },
  { id: 4, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 23750, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN23750CE', isActive: true },
  { id: 5, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24250, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24250PE', isActive: true },
];

export const createUTCForIST = (year: number, month: number, day: number, hourIST: number, minuteIST: number): Date => {
  const utcHour = hourIST - 5;
  const utcMin = minuteIST - 30;
  let finalHour = utcHour;
  let finalMin = utcMin;
  if (finalMin < 0) {
    finalMin += 60;
    finalHour -= 1;
  }
  if (finalHour < 0) {
    finalHour += 24;
  }
  return new Date(Date.UTC(year, month - 1, day, finalHour, finalMin));
};

export const createSpotCandles = (closes: number[]): CandleResampled[] => {
  return closes.map((close, i) => ({
    instrumentId: 1,
    timeframe: '15m' as Timeframe,
    barTime: createUTCForIST(2024, 1, 1, 9, 15 + i * 15),
    open: close,
    high: close + 5,
    low: close - 5,
    close,
    volume: 10000,
    oi: 1000
  }));
};

export const createStrategyConfig = (overrides: Partial<StrategyConfig> = {}): StrategyConfig => ({
  id: 'test-strategy',
  name: 'Test Strategy',
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
    blockedPeriods: ['09:15-09:30', '15:15-15:30'],
    shortOptionStopLossPct: 100,
  },
  ...overrides,
};

export const createInstruments = (): Instrument[] => [
  { id: 1, symbol: 'NIFTY', instrumentType: 'INDEX', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY-IDX', isActive: true },
  { id: 2, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000CE', isActive: true },
  { id: 3, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000PE', isActive: true },
  { id: 4, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 23750, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN23750CE', isActive: true },
  { id: 5, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24250, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24250PE', isActive: true },
];

export const createUTCForIST = (year: number, month: number, day: number, hourIST: number, minuteIST: number): Date => {
  const utcHour = hourIST - 5;
  const utcMin = minuteIST - 30;
  let finalHour = utcHour;
  let finalMin = utcMin;
  if (finalMin < 0) {
    finalMin += 60;
    finalHour -= 1;
  }
  if (finalHour < 0) {
    finalHour += 24;
  }
  return new Date(Date.UTC(year, month - 1, day, finalHour, finalMin));
};

export const createSpotCandles = (closes: number[]): CandleResampled[] => {
  return closes.map((close, i) => ({
    instrumentId: 1,
    timeframe: '15m' as Timeframe,
    barTime: createUTCForIST(2024, 1, 1, 9, 15 + i * 15),
    open: close,
    high: close + 5,
    low: close - 5,
    close,
    volume: 10000,
    oi: 1000
  }));
};

export const createStrategyConfig = (overrides: Partial<StrategyConfig> = {}): StrategyConfig => ({
  id: 'test-strategy',
  name: 'Test Strategy',
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
    blockedPeriods: ['09:15-09:30', '15:15-15:30'],
    shortOptionStopLossPct: 100,
  },
  ...overrides,
};

export const createInstruments = (): Instrument[] => [
  { id: 1, symbol: 'NIFTY', instrumentType: 'INDEX', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY-IDX', isActive: true },
  { id: 2, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000CE', isActive: true },
  { id: 3, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000PE', isActive: true },
  { id: 4, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 23750, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN23750CE', isActive: true },
  { id: 5, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24250, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24250PE', isActive: true },
];

export const createSpotCandles = (closes: number[]): CandleResampled[] => {
  return closes.map((close, i) => ({
    instrumentId: 1,
    timeframe: '15m' as Timeframe,
    barTime: createUTCForIST(2024, 1, 1, 9, 15 + i * 15),
    open: close,
    high: close + 5,
    low: close - 5,
    close,
    volume: 10000,
    oi: 1000
  }));
};

export const createUTCForIST = (year: number, month: number, day: number, hourIST: number, minuteIST: number): Date => {
  const utcHour = hourIST - 5;
  const utcMin = minuteIST - 30;
  let finalHour = utcHour;
  let finalMin = utcMin;
  if (finalMin < 0) {
    finalMin += 60;
    finalHour -= 1;
  }
  if (finalHour < 0) {
    finalHour += 24;
  }
  return new Date(Date.UTC(year, month - 1, day, finalHour, finalMin));
};

export const createStrategyConfig = (overrides: Partial<StrategyConfig> = {}): StrategyConfig => ({
  id: 'test-strategy',
  name: 'Test Strategy',
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
    blockedPeriods: ['09:15-09:30', '15:15-15:30'],
    shortOptionStopLossPct: 100,
  },
  ...overrides,
};

export const createInstruments = (): Instrument[] => [
  { id: 1, symbol: 'NIFTY', instrumentType: 'INDEX', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY-IDX', isActive: true },
  { id: 2, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000CE', isActive: true },
  { id: 3, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000PE', isActive: true },
  { id: 4, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 23750, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN23750CE', isActive: true },
  { id: 5, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24250, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24250PE', isActive: true },
];

export const createSpotCandles = (closes: number[]): CandleResampled[] => {
  return closes.map((close, i) => ({
    instrumentId: 1,
    timeframe: '15m' as Timeframe,
    barTime: createUTCForIST(2024, 1, 1, 9, 15 + i * 15),
    open: close,
    high: close + 5,
    low: close - 5,
    close,
    volume: 10000,
    oi: 1000
  }));
};

export const createUTCForIST = (year: number, month: number, day: number, hourIST: number, minuteIST: number): Date => {
  const utcHour = hourIST - 5;
  const utcMin = minuteIST - 30;
  let finalHour = utcHour;
  let finalMin = utcMin;
  if (finalMin < 0) {
    finalMin += 60;
    finalHour -= 1;
  }
  if (finalHour < 0) {
    finalHour += 24;
  }
  return new Date(Date.UTC(year, month - 1, day, finalHour, finalMin));
};

export const createStrategyConfig = (overrides: Partial<StrategyConfig> = {}): StrategyConfig => ({
  id: 'test-strategy',
  name: 'Test Strategy',
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
    blockedPeriods: ['09:15-09:30', '15:15-15:30'],
    shortOptionStopLossPct: 100,
  },
  ...overrides,
};

export const createInstruments = (): Instrument[] => [
  { id: 1, symbol: 'NIFTY', instrumentType: 'INDEX', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY-IDX', isActive: true },
  { id: 2, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000CE', isActive: true },
  { id: 3, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000PE', isActive: true },
  { id: 4, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 23750, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN23750CE', isActive: true },
  { id: 5, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24250, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24250PE', isActive: true },
];

export const createSpotCandles = (closes: number[]): CandleResampled[] => {
  return closes.map((close, i) => ({
    instrumentId: 1,
    timeframe: '15m' as Timeframe,
    barTime: createUTCForIST(2024, 1, 1, 9, 15 + i * 15),
    open: close,
    high: close + 5,
    low: close - 5,
    close,
    volume: 10000,
    oi: 1000
  }));
};

export const createUTCForIST = (year: number, month: number, day: number, hourIST: number, minuteIST: number): Date => {
  const utcHour = hourIST - 5;
  const utcMin = minuteIST - 30;
  let finalHour = utcHour;
  let finalMin = utcMin;
  if (finalMin < 0) {
    finalMin += 60;
    finalHour -= 1;
  }
  if (finalHour < 0) {
    finalHour += 24;
  }
  return new Date(Date.UTC(year, month - 1, day, finalHour, finalMin));
};

export const createStrategyConfig = (overrides: Partial<StrategyConfig> = {}): StrategyConfig => ({
  id: 'test-strategy',
  name: 'Test Strategy',
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
    blockedPeriods: ['09:15-09:30', '15:15-15:30'],
    shortOptionStopLossPct: 100,
  },
  ...overrides,
};

export const createInstruments = (): Instrument[] => [
  { id: 1, symbol: 'NIFTY', instrumentType: 'INDEX', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY-IDX', isActive: true },
  { id: 2, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000CE', isActive: true },
  { id: 3, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24000, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24000PE', isActive: true },
  { id: 4, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 23750, optionType: 'CE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN23750CE', isActive: true },
  { id: 5, symbol: 'NIFTY', instrumentType: 'OPT', underlyingSymbol: 'NIFTY', strikePrice: 24250, optionType: 'PE', expiryDate: new Date('2024-01-25'), expiryType: 'WEEKLY', lotSize: 75, tickSize: 0.05, strikeStep: 50, validFrom: new Date('2024-01-01'), validTo: null, growwToken: 'NIFTY24JAN24250PE', isActive: true },
];

export const createSpotCandles = (closes: number[]): CandleResampled[] => {
  return closes.map((close, i) => ({
    instrumentId: 1,
    timeframe: '15m' as Timeframe,
    barTime: createUTCForIST(2024, 1, 1, 9, 15 + i * 15),
    open: close,
    high: close + 5,
    low: close - 5,
    close,
    volume: 10000,
    oi: 1000
  }));
};

// Create spot candles with a clear trend for testing crossovers
const spotCandles = (() => {
  const candles = [];
  let price = 24000;
  for (let i = 0; i < 100; i++) {
    // Create a trend with crossovers
    if (i === 20) price += 100;   // Bullish crossover
    if (i === 40) price -= 150;   // Bearish crossover
    if (i === 60) price += 200;   // Bullish crossover (reversal)
    if (i === 80) price -= 250;   // Bearish crossover

    candles.push({
      instrumentId: 1,
      timeframe: '15m' as Timeframe,
      barTime: createUTCForIST(2024, 1, 1, 9, 15 + i * 15),
      open: price,
      high: price + 5,
      low: price - 5,
      close: price,
      volume: 10000,
      oi: 1000
    });
  }
  return candles;
})();

const instruments = createInstruments();
const config = createStrategyConfig();

export { spotCandles, instruments, config };