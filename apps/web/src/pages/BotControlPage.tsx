// ============================================
// BotControlPage (S12-001: Autonomous Bot Control & Telemetry)
// ============================================

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Bot, Cpu, Play, ShieldAlert, Square } from 'lucide-react';
import { RoleGuard } from '../components/AuthGuard';
import { Alert } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select } from '../components/ui/select';
import { Skeleton, SkeletonMetricCard } from '../components/ui/skeleton';
import { QueryErrorState } from '../components/ui/query-feedback';
import { fetchJson } from '../lib/api';

interface EngineHealthResponse {
  health: {
    hostId?: string;
    status?: string;
    lastCheck?: string;
    activeSessions?: number;
    errorsLastHour?: number;
  } | null;
}

interface EngineStateResponse {
  states: Array<{
    id: string;
    runType: string;
    status?: string;
    lastHeartbeat?: string;
    lastProcessedBar?: string;
  }>;
}

interface StrategyRow {
  id: string;
  name: string;
  underlyingSymbol: string;
  timeframe: string;
  executionMode: string;
  lots: number;
  isActive: boolean;
}

export function BotControlPage() {
  const qc = useQueryClient();
  const [selectedStrategyId, setSelectedStrategyId] = useState('');
  const [feedback, setFeedback] = useState('');

  const { data: healthData, isLoading: isHealthLoading, error: healthError, refetch: refetchHealth } = useQuery<EngineHealthResponse>({
    queryKey: ['engine-health'],
    refetchInterval: 5_000,
    queryFn: () => fetchJson<EngineHealthResponse>('/api/engine/health', { credentials: 'include' }),
  });

  const { data: stateData, error: stateError, refetch: refetchState } = useQuery<EngineStateResponse>({
    queryKey: ['engine-state'],
    refetchInterval: 5_000,
    queryFn: () => fetchJson<EngineStateResponse>('/api/engine/state', { credentials: 'include' }),
  });

  const { data: strategiesData, error: strategiesError, refetch: refetchStrategies } = useQuery<{ strategies: StrategyRow[] }>({
    queryKey: ['strategies'],
    queryFn: () => fetchJson<{ strategies: StrategyRow[] }>('/api/strategies', { credentials: 'include' }),
  });

  const { data: brokerData, error: brokerError, refetch: refetchBroker } = useQuery<{
    activeDataBroker?: string;
    activeExecutionBroker?: string;
    analyticsConnected?: boolean;
  }>({
    queryKey: ['upstox-status'],
    queryFn: () => fetchJson<{ activeDataBroker?: string; activeExecutionBroker?: string; analyticsConnected?: boolean }>('/api/upstox/status', { credentials: 'include' }),
  });

  const startBotMutation = useMutation({
    mutationFn: async () => {
      const strategyId = selectedStrategyId || strategiesData?.strategies?.[0]?.id;
      if (!strategyId) throw new Error('Create or select a strategy first.');
      return fetchJson('/api/paper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ strategyId }),
      });
    },
    onSuccess: () => {
      setFeedback('Paper trading bot command queued — engine will start on next poll.');
      void qc.invalidateQueries({ queryKey: ['engine-state'] });
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const stopBotMutation = useMutation({
    mutationFn: () =>
      fetchJson('/api/paper/stop', {
        method: 'POST',
        credentials: 'include',
      }),
    onSuccess: () => {
      setFeedback('Stop command sent to paper trading bot.');
      void qc.invalidateQueries({ queryKey: ['engine-state'] });
    },
    onError: (e: Error) => setFeedback(e.message),
  });

  const killMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/live/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Bot Control Center Kill Switch' }),
      });
      if (!res.ok) throw new Error('Kill switch failed');
      return res.json();
    },
    onSuccess: () => setFeedback('Emergency stop queued. Broker cancellations and protected limit close orders are processing; verify positions are flat.'),
    onError: (e: Error) => setFeedback(e.message),
  });

  const health = healthData?.health;
  const strategies = strategiesData?.strategies ?? [];
  const states = stateData?.states ?? [];
  const activeStrategyValue = selectedStrategyId || strategies[0]?.id || '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Bot className="h-6 w-6 text-emerald-400" />
            Bot Control Center
          </h2>
          <p className="text-sm text-slate-400">
            Autonomous 9/21 EMA engine telemetry, strategy runner, and kill-switch
          </p>
        </div>
        <Badge variant={health?.status === 'healthy' ? 'success' : 'warning'}>
          <Cpu className="h-3.5 w-3.5" />
          Engine: {health?.status?.toUpperCase() ?? 'UNKNOWN'}
        </Badge>
      </div>

      {feedback && <Alert variant="info">{feedback}</Alert>}
      {healthError && <QueryErrorState error={healthError} onRetry={() => void refetchHealth()} title="Engine health is unavailable" />}
      {stateError && <QueryErrorState error={stateError} onRetry={() => void refetchState()} title={states.length ? 'Showing last known bot state' : 'Bot state is unavailable'} />}
      {strategiesError && <QueryErrorState error={strategiesError} onRetry={() => void refetchStrategies()} title={strategies.length ? 'Showing last loaded strategies' : 'Strategies are unavailable'} />}
      {brokerError && <QueryErrorState error={brokerError} onRetry={() => void refetchBroker()} title="Broker status is unavailable" />}

      {isHealthLoading && !health ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonMetricCard />
          <SkeletonMetricCard />
          <SkeletonMetricCard />
          <SkeletonMetricCard />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Engine Host</CardDescription>
              <CardTitle className="font-mono text-base">{health?.hostId ?? '—'}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Bot Sessions</CardDescription>
              <CardTitle className="font-mono text-emerald-400">{health ? health.activeSessions ?? 0 : '—'}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Data Broker</CardDescription>
              <CardTitle className="font-mono uppercase text-violet-400">
                {brokerData?.activeDataBroker ?? 'groww'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Execution Broker</CardDescription>
              <CardTitle className="font-mono uppercase text-sky-400">
                {brokerData?.activeExecutionBroker ?? 'groww'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <RoleGuard role="SUPER_ADMIN" message="Demo mode is read-only. Sign in as SUPER_ADMIN to start, stop, or kill the trading bot.">
        <Card>
          <CardHeader>
            <CardTitle>Paper Bot Runner</CardTitle>
            <CardDescription>Select a 9/21 EMA strategy and launch or stop the automated paper bot</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <label className="mb-1.5 block text-xs text-slate-400">Strategy</label>
              <Select
                value={activeStrategyValue}
                onChange={(e) => setSelectedStrategyId(e.target.value)}
              >
                {strategies.length === 0 && <option value="">No strategies saved</option>}
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.underlyingSymbol} · {s.timeframe} · {s.executionMode})
                  </option>
                ))}
              </Select>
            </div>

            <Button
              variant="primary"
              onClick={() => startBotMutation.mutate()}
              disabled={startBotMutation.isPending || strategies.length === 0}
            >
              <Play className="h-4 w-4" />
              Start Paper Bot
            </Button>

            <Button
              variant="outline"
              onClick={() => stopBotMutation.mutate()}
              disabled={stopBotMutation.isPending}
            >
              <Square className="h-4 w-4" />
              Stop Paper Bot
            </Button>

            <Button
              variant="danger"
              onClick={() => killMutation.mutate()}
              disabled={killMutation.isPending}
            >
              <ShieldAlert className="h-4 w-4" />
              Kill Switch
            </Button>
          </CardContent>
        </Card>
      </RoleGuard>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-sky-400" />
            Runtime Session States
          </CardTitle>
          <CardDescription>Latest heartbeat and bar-processing state persisted by apps/engine</CardDescription>
        </CardHeader>
        <CardContent>
          {states.length === 0 ? (
            <p className="text-xs text-slate-400">No active engine sessions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {states.map((st) => (
                <div
                  key={st.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{st.runType.toUpperCase()}</Badge>
                    <span className="font-mono text-slate-200">{st.status ?? 'active'}</span>
                  </div>
                  <div className="font-mono text-slate-400">
                    Last Heartbeat: {st.lastHeartbeat ? new Date(st.lastHeartbeat).toLocaleString('en-IN') : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
