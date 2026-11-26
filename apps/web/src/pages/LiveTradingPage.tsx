import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { RoleGuard } from '../components/AuthGuard';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { QueryErrorState } from '../components/ui/query-feedback';
import { fetchJson } from '../lib/api';
import { SkeletonTable } from '../components/ui/skeleton';

interface GateItem {
  passed: boolean;
  actual?: number | string;
  required?: number;
  maxAllowed?: number;
}

interface GatesResponse {
  envEnabled: boolean;
  liveTradingEnabled: boolean;
  liveTradingRequested?: boolean;
  gates: {
    paperTradeCount: GateItem;
    profitFactor: GateItem;
    maxDrawdownPct: GateItem;
    operatorTwoFactor: GateItem;
    adminApproved: GateItem;
    growwCredentials: GateItem;
    envFlag: GateItem;
  };
}

export function LiveTradingPage() {
  const [confirmStop, setConfirmStop] = useState(false);
  const [feedback, setFeedback] = useState('');

  const { data: gatesData, refetch, error: gatesError, isLoading: isGatesLoading } = useQuery<GatesResponse>({
    queryKey: ['live-gates'],
    queryFn: async () => {
      return fetchJson<GatesResponse>('/api/live/gates', { credentials: 'include' });
    },
    retry: false,
  });

  const { data: ordersData, error: ordersError, refetch: refetchOrders, isLoading: isOrdersLoading } = useQuery<{ orders: Array<Record<string, any>> }>({
    queryKey: ['live-orders'],
    refetchInterval: 10_000,
    queryFn: () => fetchJson<{ orders: Array<Record<string, any>> }>('/api/live/orders', { credentials: 'include' }),
  });

  const { data: positionsData, error: positionsError, refetch: refetchPositions, isLoading: isPositionsLoading } = useQuery<{ positions: Array<Record<string, any>> }>({
    queryKey: ['live-positions'],
    refetchInterval: 10_000,
    queryFn: () => fetchJson<{ positions: Array<Record<string, any>> }>('/api/live/positions', { credentials: 'include' }),
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/live/enable', {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to enable live trading');
      return json;
    },
    onSuccess: () => {
      setFeedback('Live trading enabled.');
      void refetch();
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const emergencyStopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/live/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Manual Emergency Stop from AI Trader UI' }),
      });
      if (!res.ok) throw new Error('Emergency stop failed');
      return res.json();
    },
    onSuccess: () => {
      setConfirmStop(false);
      setFeedback('Emergency stop queued. Order cancellations and protected limit close orders are processing; verify broker positions are flat.');
      void refetch();
      void refetchOrders();
      void refetchPositions();
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const gateRows = gatesData
    ? [
        {
          label: 'Completed Paper Trades',
          detail: `${gatesData.gates.paperTradeCount.actual ?? 0} / ${gatesData.gates.paperTradeCount.required ?? 100}`,
          passed: gatesData.gates.paperTradeCount.passed,
        },
        {
          label: 'Paper Profit Factor',
          detail: `${gatesData.gates.profitFactor.actual ?? 0} (must be > 1.5)`,
          passed: gatesData.gates.profitFactor.passed,
        },
        {
          label: 'Max Paper Drawdown',
          detail: `${gatesData.gates.maxDrawdownPct.actual ?? 0}% (must be < 10%)`,
          passed: gatesData.gates.maxDrawdownPct.passed,
        },
        {
          label: 'Admin Approval',
          detail: gatesData.gates.adminApproved.passed ? 'Approved' : 'Pending approval',
          passed: gatesData.gates.adminApproved.passed,
        },
        {
          label: 'Operator 2FA',
          detail: gatesData.gates.operatorTwoFactor.passed ? 'Verified' : 'Not configured; live enable is disabled',
          passed: gatesData.gates.operatorTwoFactor.passed,
        },
        {
          label: 'Broker Token (Groww / Upstox)',
          detail: gatesData.gates.growwCredentials.passed ? 'Valid' : 'Needs sync in Settings',
          passed: gatesData.gates.growwCredentials.passed,
        },
        {
          label: 'Server ENABLE_LIVE_TRADING',
          detail: gatesData.gates.envFlag.passed ? 'true' : 'false (safe default)',
          passed: gatesData.gates.envFlag.passed,
        },
      ]
    : [];

  const allPassed = gateRows.length > 0 && gateRows.every((g) => g.passed);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Live Trading Desk</h2>
          <p className="text-sm text-slate-400">
            Live execution remains gated until all safety checks pass
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={gatesData?.liveTradingEnabled ? 'danger' : 'warning'}>
            <ShieldAlert className="h-3.5 w-3.5" />
            {gatesData?.liveTradingEnabled ? 'LIVE ARMED' : 'LIVE GATED (PAPER DEFAULT)'}
          </Badge>
          <Button variant="danger" onClick={() => setConfirmStop(true)}>
            <AlertTriangle className="h-4 w-4" />
            Emergency Stop
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
          {feedback}
        </div>
      )}
      {gatesError && <QueryErrorState error={gatesError} onRetry={() => void refetch()} title="Live trading gates could not be verified" />}
      {gatesData?.liveTradingRequested && !gatesData.liveTradingEnabled && (
        <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
          A previous live enable request is stored, but live execution is blocked because operator 2FA is unavailable. Use Emergency Stop to clear the stored request.
        </div>
      )}

      {confirmStop && (
        <Card className="border-rose-500/50 bg-rose-950/30">
          <CardHeader>
            <CardTitle className="text-rose-300">Confirm Immediate Emergency Stop</CardTitle>
            <CardDescription>
              Requests cancellation of open orders and submits protected limit orders to close positions. Verify fills at the broker before treating the account as flat.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              variant="danger"
              onClick={() => emergencyStopMutation.mutate()}
              disabled={emergencyStopMutation.isPending}
            >
              Confirm Kill Switch
            </Button>
            <Button variant="outline" onClick={() => setConfirmStop(false)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      <RoleGuard role="SUPER_ADMIN" message="Live trading controls are restricted to SUPER_ADMIN.">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Live Safety Prerequisites</CardTitle>
            <CardDescription>Every check must pass before live capital can be deployed</CardDescription>
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={!allPassed || enableMutation.isPending}
            onClick={() => enableMutation.mutate()}
          >
            Enable Live Mode
          </Button>
        </CardHeader>
        <CardContent>
          {gatesError ? null : gateRows.length === 0 ? (
            <p className="text-sm text-slate-400">{isGatesLoading ? 'Loading live safety checks…' : 'Sign in via Settings to inspect your live trading gate status.'}</p>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {gateRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium text-slate-100">{row.label}</div>
                    <div className="font-mono text-xs text-slate-400">{row.detail}</div>
                  </div>
                  {row.passed ? (
                    <Badge variant="success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> PASS
                    </Badge>
                  ) : (
                    <Badge variant="danger">
                      <XCircle className="h-3.5 w-3.5" /> BLOCKED
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </RoleGuard>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Open Live Positions</CardTitle>
            <CardDescription>{(positionsData?.positions ?? []).length} active position(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {positionsError && <QueryErrorState error={positionsError} onRetry={() => void refetchPositions()} title="Live position status unavailable" />}
            {positionsError && !positionsData ? null : isPositionsLoading && !positionsData ? <SkeletonTable rows={3} cols={3} /> : (positionsData?.positions ?? []).length === 0 ? (
              <p className="text-xs text-slate-400">No open live positions.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {positionsData?.positions.map((pos, idx) => (
                  <div key={pos['id'] ?? idx} className="flex justify-between rounded border border-slate-800 px-3 py-2 font-mono">
                    <span>{pos['optionSymbol']} ({pos['quantity']})</span>
                    <span>₹{Number(pos['unrealizedPnl'] ?? 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Live Orders</CardTitle>
            <CardDescription>{(ordersData?.orders ?? []).length} recent fill(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {ordersError && <QueryErrorState error={ordersError} onRetry={() => void refetchOrders()} title="Live order status unavailable" />}
            {ordersError && !ordersData ? null : isOrdersLoading && !ordersData ? <SkeletonTable rows={3} cols={3} /> : (ordersData?.orders ?? []).length === 0 ? (
              <p className="text-xs text-slate-400">No live orders placed yet.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {ordersData?.orders.slice(0, 10).map((ord, idx) => (
                  <div key={ord['id'] ?? idx} className="flex justify-between rounded border border-slate-800 px-3 py-2 font-mono">
                    <span>{ord['optionSymbol']} · {ord['side']} · {ord['quantity']}</span>
                    <Badge variant={ord['status'] === 'COMPLETE' ? 'success' : 'info'}>{ord['status']}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
