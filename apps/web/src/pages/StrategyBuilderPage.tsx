import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { SymbolSearchInput } from '../components/SymbolSearchInput';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { QueryErrorState } from '../components/ui/query-feedback';
import { fetchJson } from '../lib/api';
import { cn } from '../lib/utils';

interface StrategyRow {
  id: string;
  name: string;
  underlyingSymbol: string;
  timeframe: string;
  executionMode: string;
  lots: number;
  isActive: boolean;
}

export function StrategyBuilderPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('NIFTY 15m 9/21 EMA');
  const [underlyingSymbol, setUnderlyingSymbol] = useState('NIFTY');
  const [timeframe, setTimeframe] = useState<'5m' | '15m' | '30m'>('15m');
  const [executionMode, setExecutionMode] = useState<'DEEP_ITM_BUY' | 'ATM_BUY' | 'ATM_SELL'>('DEEP_ITM_BUY');
  const [entryStartTime, setEntryStartTime] = useState('09:30');
  const [entryEndTime, setEntryEndTime] = useState('11:30');
  const [lots, setLots] = useState(1);

  const { data, error, refetch } = useQuery<{ strategies: StrategyRow[] }>({
    queryKey: ['strategies'],
    queryFn: () => fetchJson<{ strategies: StrategyRow[] }>('/api/strategies', { credentials: 'include' }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          underlyingSymbol,
          timeframe,
          executionMode,
          entryStartTime,
          entryEndTime,
          lots,
        }),
      });
      if (!res.ok) throw new Error('Failed to create strategy');
      return res.json();
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['strategies'] }),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-white">Strategy Builder</h2>
      {error && <QueryErrorState error={error} onRetry={() => void refetch()} title="Saved strategies are unavailable" />}

      <Card>
        <CardHeader>
          <CardTitle>New 9/21 EMA Strategy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <label className="text-xs text-slate-400">
            Name
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </label>

          <div className="text-xs text-slate-400">
            <span className="mb-1 block">Underlying / Stock Symbol</span>
            <SymbolSearchInput
              value={underlyingSymbol}
              onChange={(sym) => setUnderlyingSymbol(sym)}
              placeholder="Search NSE stock or index…"
            />
          </div>

          <label className="text-xs text-slate-400">
            Timeframe
            <Select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as '5m' | '15m' | '30m')}
              className="mt-1"
            >
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="30m">30m</option>
            </Select>
          </label>

          <label className="text-xs text-slate-400">
            Execution Mode
            <Select
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value as 'DEEP_ITM_BUY' | 'ATM_BUY' | 'ATM_SELL')}
              className="mt-1"
            >
              <option value="DEEP_ITM_BUY">DEEP_ITM_BUY</option>
              <option value="ATM_BUY">ATM_BUY</option>
              <option value="ATM_SELL">ATM_SELL</option>
            </Select>
          </label>

          <label className="text-xs text-slate-400">
            Entry Start (IST)
            <Input value={entryStartTime} onChange={(e) => setEntryStartTime(e.target.value)} className="mt-1" />
          </label>

          <label className="text-xs text-slate-400">
            Entry End (IST)
            <Input value={entryEndTime} onChange={(e) => setEntryEndTime(e.target.value)} className="mt-1" />
          </label>

          <label className="text-xs text-slate-400">
            Lots
            <Input
              type="number"
              min={1}
              value={lots}
              onChange={(e) => setLots(Number(e.target.value))}
              className="mt-1"
            />
          </label>

          <div className="flex items-end">
            <Button
              variant="primary"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Saving...' : 'Save Strategy'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <h3 className="mb-3 font-semibold text-white">Saved Strategies</h3>
        {(data?.strategies ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">No strategies yet (sign in via Settings to create/view).</p>
        ) : (
          <div className="space-y-2">
            {data?.strategies.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 px-4 py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium text-white">{s.name}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {s.underlyingSymbol} · {s.timeframe} · {s.executionMode} · {s.lots} lot(s)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
                    <Switch
                      id={`strategy-switch-${s.id}`}
                      checked={s.isActive}
                      onCheckedChange={async (checked) => {
                        await fetch(`/api/strategies/${s.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ isActive: checked }),
                        });
                        void qc.invalidateQueries({ queryKey: ['strategies'] });
                      }}
                      aria-label="Toggle active strategy"
                    />
                    <span className={cn('text-xs font-semibold', s.isActive ? 'text-emerald-400' : 'text-slate-500')}>
                      {s.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
                    onClick={async () => {
                      await fetch('/api/paper/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ strategyId: s.id }),
                      });
                    }}
                  >
                    Launch Bot
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await fetch(`/api/strategies/${s.id}/clone`, {
                        method: 'POST',
                        credentials: 'include',
                      });
                      void qc.invalidateQueries({ queryKey: ['strategies'] });
                    }}
                  >
                    Clone
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      await fetch(`/api/strategies/${s.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      });
                      void qc.invalidateQueries({ queryKey: ['strategies'] });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
