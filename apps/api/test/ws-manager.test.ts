import { describe, expect, test } from 'bun:test';
import { wsManager } from '../src/services/ws-manager';

describe('WebSocketManager user-scoping (GAP-25)', () => {
  test('isolates private live_updates and paper_updates by userId and drops unscoped broadcasts', () => {
    const msgsA: string[] = [];
    const msgsB: string[] = [];
    const sockA = { send: (d: string) => msgsA.push(d) };
    const sockB = { send: (d: string) => msgsB.push(d) };

    wsManager.registerClient(sockA, 'user-a');
    wsManager.registerClient(sockB, 'user-b');
    wsManager.subscribe(sockA, 'live_updates');
    wsManager.subscribe(sockB, 'live_updates');
    wsManager.subscribe(sockA, 'ticks');
    wsManager.subscribe(sockB, 'ticks');

    // Private channel scoped to user-a
    wsManager.broadcast('live_updates', { orderId: 'ord-1', userId: 'user-a' });
    expect(msgsA.length).toBe(1);
    expect(msgsB.length).toBe(0);

    // Private channel without userId must be dropped
    wsManager.broadcast('live_updates', { orderId: 'ord-orphan' });
    expect(msgsA.length).toBe(1);
    expect(msgsB.length).toBe(0);

    // Public channel reaches both
    wsManager.broadcast('ticks', { symbol: 'NIFTY', ltp: 24500 });
    expect(msgsA.length).toBe(2);
    expect(msgsB.length).toBe(1);

    wsManager.removeClient(sockA);
    wsManager.removeClient(sockB);
  });
});
