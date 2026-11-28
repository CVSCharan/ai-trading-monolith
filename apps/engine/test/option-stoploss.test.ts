import { describe, expect, test } from 'bun:test';
import pino from 'pino';
import { LiveTradingEngine } from '../src/services/live-trading';

describe('LiveTradingEngine Option Stop-Loss (GAP-05)', () => {
  test('triggers protected BUY close when short option premium rises >= shortOptionStopLossPct', async () => {
    const placedOrders: Array<Record<string, unknown>> = [];
    const mockGroww = {
      placeOrder: async (order: Record<string, unknown>) => {
        placedOrders.push(order);
        return { orderId: `close-${placedOrders.length}`, status: 'OPEN' };
      },
    } as any;

    const engine = new LiveTradingEngine(null, pino({ level: 'silent' }), mockGroww);
    (engine as any).positions.set('NIFTY26MAR24500PE', {
      id: 'pos-1',
      userId: 'user-1',
      optionSymbol: 'NIFTY26MAR24500PE',
      side: 'SELL',
      targetQuantity: 75,
      filledQuantity: 75,
      avgEntryPrice: 100,
      currentPrice: 100,
      status: 'OPEN',
      idempotencyKey: 'idem-1',
    });

    // +50% adverse move: below 100% SL threshold
    const triggered1 = await engine.onOptionTick('NIFTY26MAR24500PE', 150, { shortOptionStopLossPct: 100 });
    expect(triggered1).toBe(false);
    expect(placedOrders.length).toBe(0);

    // +100% adverse move: triggers protected BUY limit close
    const triggered2 = await engine.onOptionTick('NIFTY26MAR24500PE', 200, { shortOptionStopLossPct: 100 });
    expect(triggered2).toBe(true);
    expect(placedOrders.length).toBe(1);
    expect(placedOrders[0]?.['side']).toBe('BUY');
    expect(placedOrders[0]?.['orderType']).toBe('LIMIT');
    expect(placedOrders[0]?.['price']).toBe(204);
  });
});
