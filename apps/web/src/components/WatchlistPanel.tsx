// ============================================
// WatchlistPanel (S8-001: DB-backed Custom Watchlist)
// ============================================

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bookmark, Plus, Search, Trash2, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { QueryErrorState } from './ui/query-feedback';
import { fetchJson } from '../lib/api';

interface WatchlistItem {
  id: string;
  symbol: string;
  exchange: string;
  segment: string;
  notes?: string | null;
}

interface SearchResult {
  symbol: string;
  name?: string | null;
  exchange: string;
  segment: string;
  instrumentType: string;
}

export function WatchlistPanel() {
  const { isDemo } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { data: watchlistData, isLoading, error, refetch } = useQuery<{ items: WatchlistItem[] }>({
    queryKey: ['watchlist'],
    queryFn: () => fetchJson<{ items: WatchlistItem[] }>('/api/watchlist', { credentials: 'include' }),
  });

  const { data: searchData, error: searchError, refetch: refetchSearch } = useQuery<{ results: SearchResult[] }>({
    queryKey: ['watchlist-search', searchQuery],
    enabled: showSearch,
    queryFn: () => fetchJson<{ results: SearchResult[] }>(`/api/instruments/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include',
      }),
  });

  const addMutation = useMutation({
    mutationFn: async (item: { symbol: string; exchange: string; segment: string }) => {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error('Failed to pin symbol');
      return res.json();
    },
    onSuccess: () => {
      void refetch();
      setShowSearch(false);
      setSearchQuery('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/watchlist/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove symbol');
      return res.json();
    },
    onSuccess: () => void refetch(),
  });

  const items = watchlistData?.items ?? [];
  const results = searchData?.results ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-sky-400" />
            Custom Watchlist
          </CardTitle>
          <CardDescription>Pinned NIFTY / BANKNIFTY &amp; F&amp;O contracts</CardDescription>
        </div>
        {!isDemo && (
          <Button variant="outline" size="sm" onClick={() => setShowSearch((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Pin Symbol
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <QueryErrorState error={error} onRetry={() => void refetch()} title={items.length ? 'Showing the last loaded watchlist' : 'Watchlist is unavailable'} />}
        {showSearch && !isDemo && (
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search instruments (e.g. NIFTY, BANKNIFTY)…"
                className="w-full rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-3 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {results.map((r, i) => (
                <button
                  key={`${r.symbol}-${i}`}
                  type="button"
                  onClick={() =>
                    addMutation.mutate({
                      symbol: r.symbol,
                      exchange: r.exchange,
                      segment: r.segment,
                    })
                  }
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-slate-800/80"
                >
                  <div>
                    <span className="font-mono font-medium text-white">{r.symbol}</span>
                    {r.name && <span className="ml-2 text-slate-400">{r.name}</span>}
                  </div>
                  <Badge variant="info">{r.instrumentType}</Badge>
                </button>
              ))}
              {searchError ? (
                <div className="flex items-center justify-between gap-2 py-1 text-[11px] text-rose-300" role="alert">
                  <span>Instrument search is unavailable.</span>
                  <button type="button" onClick={() => void refetchSearch()} className="underline">Retry</button>
                </div>
              ) : results.length === 0 && searchQuery.trim() ? (
                <p className="text-[11px] text-slate-500 py-1">No matching instruments found.</p>
              ) : null}
            </div>
          </div>
        )}

        {isLoading && items.length === 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-14" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : error && items.length === 0 ? null : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-400">
            No pinned symbols yet. Pin NIFTY or BANKNIFTY to monitor quick jumps.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-white">{item.symbol}</span>
                    <Badge variant="info">{item.exchange}</Badge>
                  </div>
                  <div className="text-[11px] text-slate-500">{item.segment}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    to="/backtest"
                    title="Run Backtest"
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-sky-400"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                  </Link>
                  {!isDemo && (
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(item.id)}
                      title="Remove from watchlist"
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
