import { describe, expect, test } from 'bun:test';
import { createBrokerRouter } from '../src/services/broker-router';
import type { GrowwClient } from '../src/services/groww-client';

describe('BrokerRouter (S11-001)', () => {
  const mockGroww = {} as GrowwClient;

  test('defaults to groww for both data and execution when env unset', () => {
    delete process.env['ACTIVE_DATA_BROKER'];
    delete process.env['ACTIVE_EXECUTION_BROKER'];

    const router = createBrokerRouter(mockGroww);
    expect(router.activeDataBrokerName).toBe('groww');
    expect(router.activeExecutionBrokerName).toBe('groww');
    expect(router.dataBroker.name).toBe('groww');
    expect(router.executionBroker.name).toBe('groww');
  });

  test('routes dataBroker to upstox when ACTIVE_DATA_BROKER=upstox', () => {
    process.env['ACTIVE_DATA_BROKER'] = 'upstox';
    process.env['ACTIVE_EXECUTION_BROKER'] = 'groww';

    const router = createBrokerRouter(mockGroww);
    expect(router.activeDataBrokerName).toBe('upstox');
    expect(router.activeExecutionBrokerName).toBe('groww');
    expect(router.dataBroker.name).toBe('upstox');
    expect(router.executionBroker.name).toBe('groww');

    delete process.env['ACTIVE_DATA_BROKER'];
    delete process.env['ACTIVE_EXECUTION_BROKER'];
  });
});
