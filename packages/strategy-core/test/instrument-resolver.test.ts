import { describe, expect, test } from 'bun:test';
import { buildInstrumentIndex, selectStrike } from '../src/execution/instrument-resolver';
import { createInstruments, createUTCForIST } from './test-utils';
import type { Instrument } from '../src/types';

describe('Instrument Resolver (S2-003)', () => {
  const signalTime = createUTCForIST(2024, 1, 15, 10, 0);

  test('DEEP_ITM_BUY + BUY selects CE at ATM - 5*step', () => {
    const res = selectStrike(24010, 'BUY', 'DEEP_ITM_BUY', 5, createInstruments(), signalTime);
    expect(res.strike).toBe(23750);
    expect(res.optionType).toBe('CE');
    expect(res.optionSymbol).toBe('NIFTY24JAN23750CE');
  });

  test('DEEP_ITM_BUY + SELL selects PE at ATM + 5*step', () => {
    const res = selectStrike(23990, 'SELL', 'DEEP_ITM_BUY', 5, createInstruments(), signalTime);
    expect(res.strike).toBe(24250);
    expect(res.optionType).toBe('PE');
    expect(res.optionSymbol).toBe('NIFTY24JAN24250PE');
  });

  test('ATM_BUY selects CE for BUY and PE for SELL at ATM', () => {
    const buyRes = selectStrike(24010, 'BUY', 'ATM_BUY', 5, createInstruments(), signalTime);
    expect(buyRes.strike).toBe(24000);
    expect(buyRes.optionType).toBe('CE');

    const sellRes = selectStrike(24010, 'SELL', 'ATM_BUY', 5, createInstruments(), signalTime);
    expect(sellRes.strike).toBe(24000);
    expect(sellRes.optionType).toBe('PE');
  });

  test('ATM_SELL selects short PE for BUY and short CE for SELL', () => {
    const buyRes = selectStrike(24000, 'BUY', 'ATM_SELL', 5, createInstruments(), signalTime);
    expect(buyRes.strike).toBe(24000);
    expect(buyRes.optionType).toBe('PE');

    const sellRes = selectStrike(24000, 'SELL', 'ATM_SELL', 5, createInstruments(), signalTime);
    expect(sellRes.strike).toBe(24000);
    expect(sellRes.optionType).toBe('CE');
  });

  test('rolls to next expiry when days to expiry < avoidExpiryDays', () => {
    const nearExpiry = createUTCForIST(2024, 1, 24, 10, 0); // 1 day before Jan 25
    const instruments: Instrument[] = [
      ...createInstruments(),
      {
        id: 6,
        symbol: 'NIFTY',
        instrumentType: 'OPT',
        underlyingSymbol: 'NIFTY',
        strikePrice: 24000,
        optionType: 'CE',
        expiryDate: new Date('2024-02-01'),
        expiryType: 'WEEKLY',
        lotSize: 75,
        tickSize: 0.05,
        strikeStep: 50,
        validFrom: new Date('2024-01-01'),
        validTo: null,
        growwToken: 'NIFTY24FEB24000CE',
        isActive: true,
      },
    ];
    const res = selectStrike(24000, 'BUY', 'ATM_BUY', 5, instruments, nearExpiry, 'WEEKLY', 2);
    expect(res.optionSymbol).toBe('NIFTY24FEB24000CE');
  });

  test('throws when no matching option instrument is found', () => {
    expect(() =>
      selectStrike(25000, 'BUY', 'ATM_BUY', 5, createInstruments(), signalTime)
    ).toThrow();
  });

  test('S2-007: buildInstrumentIndex enables O(1) strike lookup with identical result', () => {
    const instruments = createInstruments();
    const index = buildInstrumentIndex(instruments);
    const indexed = selectStrike(24010, 'BUY', 'DEEP_ITM_BUY', 5, instruments, signalTime, 'WEEKLY', 2, index);
    expect(indexed.optionSymbol).toBe('NIFTY24JAN23750CE');
    expect(indexed.strike).toBe(23750);
  });
});
