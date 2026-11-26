// ============================================
// OptionChainPage (S11-003: Upstox Analytics Option Chain)
// ============================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers, RefreshCw } from 'lucide-react';
import type { OptionChainRow } from '@groww-trading/shared';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { SkeletonMetricCard, SkeletonTable } from '../components/ui/skeleton';
import { QueryErrorState } from '../components/ui/query-feedback';
import { fetchJson } from '../lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

interface OptionChainResponse {
  instrumentKey?: string;
  expiryDate?: string;
  rows?: OptionChainRow[];
  error?: string;
}

const UNDERLYINGS = [
  { label: 'NIFTY 50', key: 'NSE_INDEX|Nifty 50' },
  { label: 'NIFTY BANK', key: 'NSE_INDEX|Nifty Bank' },
];

function getNextThursday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = (4 - day + 7) % 7 || 7;
  now.setDate(now.getDate() + diff);
  return now.toISOString().slice(0, 10);
}

export function OptionChainPage() {
  const [instrumentKey, setInstrumentKey] = useState(UNDERLYINGS[0].key);
  const [expiryDate, setExpiryDate] = useState(getNextThursday);

  const { data, isLoading, isFetching, error, refetch } = useQuery<OptionChainResponse>({
    queryKey: ['upstox-option-chain', instrumentKey, expiryDate],
    queryFn: async () => {
      const qs = new URLSearchParams({ instrumentKey, expiryDate });
      return fetchJson<OptionChainResponse>(`/api/upstox/option-chain?${qs.toString()}`, {
        credentials: 'include',
      });
    },
    retry: false,
  });

  const rows = data?.rows ?? [];
  const totalCallOi = rows.reduce((s, r) => s + (r.call?.oi ?? 0), 0);
  const totalPutOi = rows.reduce((s, r) => s + (r.put?.oi ?? 0), 0);
  const pcr = totalCallOi > 0 ? totalPutOi / totalCallOi : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-violet-400" />
            Option Chain
          </h2>
          <p className="text-sm text-slate-400">
            Live OI, IV, Delta &amp; PCR powered by Upstox Analytics Token (no Static IP needed)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={instrumentKey}
            onChange={(e) => setInstrumentKey(e.target.value)}
            className="w-auto text-xs"
          >
            {UNDERLYINGS.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </Select>

          <Input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-auto text-xs"
          />

          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && !data ? (
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
      </div>
      ) : error && !data ? null : (
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Call OI</CardDescription>
            <CardTitle className="font-mono text-rose-400">{totalCallOi.toLocaleString('en-IN')}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Put OI</CardDescription>
            <CardTitle className="font-mono text-emerald-400">{totalPutOi.toLocaleString('en-IN')}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Put-Call Ratio (PCR)</CardDescription>
              <CardTitle className="font-mono text-white">{pcr.toFixed(2)}</CardTitle>
            </div>
            <Badge variant={pcr >= 1 ? 'success' : 'warning'}>
              {pcr >= 1 ? 'Bullish Bias' : 'Bearish / Neutral'}
            </Badge>
          </CardHeader>
        </Card>
      </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Strikes Ladder</CardTitle>
          <CardDescription>
            {data?.error
              ? data.error
              : `${rows.length} strikes loaded for ${expiryDate}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <QueryErrorState error={error} onRetry={() => void refetch()} title={rows.length ? 'Showing previously loaded option data' : 'Option chain is unavailable'} />}
          {isLoading && !data ? (
            <SkeletonTable rows={10} cols={9} className="py-2" />
          ) : error && rows.length === 0 ? null : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
              {data?.error
                ? 'Set UPSTOX_ANALYTICS_TOKEN in .env to stream live Option Chain data.'
                : 'No option chain rows returned for the selected expiry.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CE OI</TableHead>
                  <TableHead>CE IV</TableHead>
                  <TableHead>CE Δ</TableHead>
                  <TableHead className="text-rose-300">CE LTP</TableHead>
                  <TableHead className="text-center font-bold text-white">STRIKE</TableHead>
                  <TableHead className="text-emerald-300">PE LTP</TableHead>
                  <TableHead>PE Δ</TableHead>
                  <TableHead>PE IV</TableHead>
                  <TableHead className="text-right">PE OI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.strikePrice}>
                    <TableCell className="font-mono text-xs">{row.call?.oi?.toLocaleString('en-IN') ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.call?.iv?.toFixed(1) ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.call?.delta?.toFixed(2) ?? '—'}</TableCell>
                    <TableCell className="font-mono font-semibold text-rose-400">
                      ₹{row.call?.ltp?.toFixed(2) ?? '—'}
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-white bg-slate-900/60">
                      {row.strikePrice}
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-emerald-400">
                      ₹{row.put?.ltp?.toFixed(2) ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.put?.delta?.toFixed(2) ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.put?.iv?.toFixed(1) ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {row.put?.oi?.toLocaleString('en-IN') ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
