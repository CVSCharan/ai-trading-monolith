import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Send, XCircle } from 'lucide-react';
import { RoleGuard } from '../components/AuthGuard';
import { SymbolSearchInput } from '../components/SymbolSearchInput';
import { Alert } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Skeleton, SkeletonTable } from '../components/ui/skeleton';
import { QueryErrorState } from '../components/ui/query-feedback';
import { fetchJson } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

export function PaperTradingPage() {
  const qc = useQueryClient();
  const { connected, events } = useWebSocket(['ticks', 'signals', 'paper_updates']);

  const [symbol, setSymbol] = useState('RELIANCE');
  const [instrumentKey, setInstrumentKey] = useState('NSE_EQ|INE002A01018');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState(10);
  const [price, setPrice] = useState(2950);
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<{ variant: 'success' | 'danger' | 'info'; text: string } | null>(null);

  const fetchLiveQuote = async (key: string) => {
    try {
      const res = await fetch(`/api/market/quote?instrumentKey=${encodeURIComponent(key)}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        marketOpen?: boolean;
        quote?: { ltp?: number } | null;
      };
      if (json.marketOpen !== undefined) setMarketOpen(json.marketOpen);
      if (json.quote?.ltp && json.quote.ltp > 0) {
        setPrice(json.quote.ltp);
      }
    } catch {
      // keep manual price if offline
    }
  };

  const { data: portfolioData, error: portfolioError, refetch: refetchPortfolio } = useQuery<{ portfolio: Record<string, any> | null }>({
    queryKey: ['paper-portfolio'],
    refetchInterval: 5_000,
    queryFn: () => fetchJson<{ portfolio: Record<string, any> | null }>('/api/paper/portfolio', { credentials: 'include' }),
  });

  const { data: positionsData, isLoading: isPositionsLoading, error: positionsError, refetch: refetchPositions } = useQuery<{ positions: Array<Record<string, any>> }>({
    queryKey: ['paper-positions'],
    refetchInterval: 5_000,
    queryFn: () => fetchJson<{ positions: Array<Record<string, any>> }>('/api/paper/positions', { credentials: 'include' }),
  });

  const { data: historyData, isLoading: isHistoryLoading, error: historyError, refetch: refetchHistory } = useQuery<{ trades: Array<Record<string, any>> }>({
    queryKey: ['paper-history'],
    refetchInterval: 10_000,
    queryFn: () => fetchJson<{ trades: Array<Record<string, any>> }>('/api/paper/history?limit=50', { credentials: 'include' }),
  });

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ['paper-portfolio'] });
    void qc.invalidateQueries({ queryKey: ['paper-positions'] });
    void qc.invalidateQueries({ queryKey: ['paper-history'] });
  };

  const placeOrderMutation = useMutation({
    mutationFn: () =>
      fetchJson('/api/paper/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ symbol, side, quantity, price }),
      }),
    onSuccess: () => {
      setFeedback({ variant: 'success', text: `Paper ${side} ${quantity} ${symbol} @ ₹${price} filled.` });
      refreshAll();
    },
    onError: (e: Error) => setFeedback({ variant: 'danger', text: e.message }),
  });

  const closeMutation = useMutation({
    mutationFn: (pos: Record<string, any>) =>
      fetchJson<{ netPnl?: number }>(`/api/paper/close/${pos['id']}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ exitPrice: Number(pos['currentPrice'] ?? pos['avgEntryPrice']) }),
      }),
    onSuccess: (data) => {
      setFeedback({ variant: 'info', text: `Position squared off. Net P&L: ₹${Number(data.netPnl ?? 0).toFixed(2)}` });
      refreshAll();
    },
    onError: (e: Error) => setFeedback({ variant: 'danger', text: e.message }),
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      fetchJson('/api/paper/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ capital: 1_000_000 }),
      }),
    onSuccess: () => {
      setFeedback({ variant: 'info', text: 'Paper capital reset to ₹10,00,000.' });
      refreshAll();
    },
    onError: (e: Error) => setFeedback({ variant: 'danger', text: e.message }),
  });

  const portfolio = portfolioData?.portfolio;
  const positions = positionsData?.positions ?? [];
  const trades = historyData?.trades ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Unlimited Paper Trading Desk</h2>
          <p className="text-sm text-slate-400">
            Trade any NSE/NFO stock, index, or option anytime with simulated fills &amp; costs
          </p>
        </div>
        <div className="flex items-center gap-2">
          {marketOpen !== null && (
            <Badge variant={marketOpen ? 'success' : 'warning'}>
              NSE: {marketOpen ? 'OPEN' : 'CLOSED'}
            </Badge>
          )}
          <Badge variant={connected ? 'success' : 'warning'}>
            WS: {connected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset ₹10L
          </Button>
        </div>
      </div>

      {feedback && <Alert variant={feedback.variant}>{feedback.text}</Alert>}
      {portfolioError && <QueryErrorState error={portfolioError} onRetry={() => void refetchPortfolio()} title="Portfolio balance is unavailable" />}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-400">Total Value</div>
            <div className="mt-1 font-mono text-xl font-semibold text-white">
              {portfolioError && !portfolio ? 'Unavailable' : portfolio ? `₹${Number(portfolio.totalValue ?? 0).toLocaleString('en-IN')}` : 'Not initialized'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-400">Cash Balance</div>
            <div className="mt-1 font-mono text-xl font-semibold text-slate-200">
              {portfolioError && !portfolio ? 'Unavailable' : portfolio ? `₹${Number(portfolio.cashBalance ?? 0).toLocaleString('en-IN')}` : 'Not initialized'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-400">Daily P&amp;L</div>
            <div className={`mt-1 font-mono text-xl font-semibold ${Number(portfolio?.dailyPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {portfolioError && !portfolio ? 'Unavailable' : portfolio ? `₹${Number(portfolio.dailyPnl ?? 0).toFixed(2)}` : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      <RoleGuard role="SUPER_ADMIN" message="Demo mode is read-only. Sign in as SUPER_ADMIN to place manual paper orders.">
        <Card>
          <CardHeader>
            <CardTitle>Quick Paper Order (Any Stock / Index / Option)</CardTitle>
            <CardDescription>Place unlimited virtual trades anytime without risking real capital</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SymbolSearchInput
              value={symbol}
              onChange={(sym, hit) => {
                setSymbol(sym);
                if (hit) {
                  setInstrumentKey(hit.instrumentKey);
                  if (hit.lotSize > 1) setQuantity(hit.lotSize);
                  void fetchLiveQuote(hit.instrumentKey);
                }
              }}
              placeholder="Search any NSE stock/option…"
            />
            <Select value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
              <option value="BUY">BUY (Long)</option>
              <option value="SELL">SELL (Short)</option>
            </Select>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              placeholder="Qty"
            />
            <Input
              type="number"
              step="0.05"
              min={0.05}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              placeholder="Price (₹)"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => void fetchLiveQuote(instrumentKey)}
              >
                LTP
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => placeOrderMutation.mutate()}
                disabled={placeOrderMutation.isPending || !symbol || quantity <= 0 || price <= 0}
              >
                <Send className="h-4 w-4" />
                Place Paper Order
              </Button>
            </div>
          </CardContent>
        </Card>
      </RoleGuard>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Open Paper Positions ({positions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {positionsError && <QueryErrorState error={positionsError} onRetry={() => void refetchPositions()} title={positions.length ? 'Showing previously loaded positions' : 'Positions are unavailable'} />}
            {positionsError && positions.length === 0 ? null : isPositionsLoading && positions.length === 0 ? (
              <SkeletonTable rows={3} cols={4} className="py-1" />
            ) : positions.length === 0 ? (
              <p className="text-sm text-slate-400">No open paper positions.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {positions.map((p) => (
                  <div key={p['id']} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2">
                    <div>
                      <span className="font-mono font-medium text-white">{p['optionSymbol']}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {p['side']} · {p['quantity']} @ ₹{Number(p['avgEntryPrice']).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs ${Number(p['unrealizedPnl'] ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ₹{Number(p['unrealizedPnl'] ?? 0).toFixed(2)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => closeMutation.mutate(p)}
                        disabled={closeMutation.isPending}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Square Off
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live Signal &amp; Tick Feed</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-slate-400">Waiting for live events on /api/market/ws...</p>
            ) : (
              <div className="space-y-2 text-xs">
                {events.slice(0, 15).map((ev, idx) => (
                  <div key={idx} className="rounded border border-slate-800 bg-slate-950 p-2 text-slate-300">
                    <span className="font-semibold text-sky-400">[{ev.channel}]</span> {JSON.stringify(ev.data)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paper Trade History ({trades.length})</CardTitle>
          <CardDescription>All completed paper trades with simulated brokerage &amp; taxes</CardDescription>
        </CardHeader>
        <CardContent>
          {historyError && <QueryErrorState error={historyError} onRetry={() => void refetchHistory()} title={trades.length ? 'Showing previously loaded history' : 'Trade history is unavailable'} />}
          {historyError && trades.length === 0 ? null : isHistoryLoading && trades.length === 0 ? (
            <SkeletonTable rows={6} cols={7} className="py-2" />
          ) : trades.length === 0 ? (
            <p className="text-xs text-slate-400">No closed paper trades yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Exit</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Net P&amp;L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((t) => {
                  const pnl = Number(t['netPnl'] ?? 0);
                  return (
                    <TableRow key={t['id']}>
                      <TableCell className="font-mono font-medium">{t['optionSymbol']}</TableCell>
                      <TableCell><Badge variant="info">{t['side']}</Badge></TableCell>
                      <TableCell className="font-mono">{t['quantity']}</TableCell>
                      <TableCell className="font-mono">₹{Number(t['entryPrice']).toFixed(2)}</TableCell>
                      <TableCell className="font-mono">₹{Number(t['exitPrice'] ?? t['entryPrice']).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-slate-400">{t['exitReason'] ?? '—'}</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
