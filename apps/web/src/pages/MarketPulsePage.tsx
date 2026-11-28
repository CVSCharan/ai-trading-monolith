import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Newspaper, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select } from '../components/ui/select';
import { SkeletonTable } from '../components/ui/skeleton';
import { QueryErrorState } from '../components/ui/query-feedback';
import { fetchJson } from '../lib/api';

interface NewsItem {
  id: string;
  symbol: string | null;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  eventType: string;
  aiRationale: string;
  suggestedRegime: string;
}

interface BriefResponse {
  brief: {
    id: string;
    briefType: string;
    istDate: string;
    headline: string;
    summaryMarkdown: string;
    marketRegime: string;
    watchlistHighlights: Array<{
      symbol: string;
      count: number;
      sentiment: string;
      topHeadline: string;
    }>;
  } | null;
}

export function MarketPulsePage() {
  const qc = useQueryClient();
  const [symbolFilter, setSymbolFilter] = useState('ALL');
  const [sentimentFilter, setSentimentFilter] = useState('ALL');
  const [watchlistOnly, setWatchlistOnly] = useState(true);

  const {
    data: newsData,
    isLoading: isNewsLoading,
    error: newsError,
    refetch: refetchNews,
  } = useQuery<{ items: NewsItem[]; pinnedSymbols: string[] }>({
    queryKey: ['market-news', symbolFilter, sentimentFilter, watchlistOnly],
    queryFn: () => {
      const qs = new URLSearchParams({
        symbol: symbolFilter,
        sentiment: sentimentFilter,
        watchlistOnly: String(watchlistOnly),
        limit: '40',
      });
      return fetchJson<{ items: NewsItem[]; pinnedSymbols: string[] }>(`/api/news?${qs.toString()}`, {
        credentials: 'include',
      });
    },
  });

  const {
    data: briefData,
    error: briefError,
    refetch: refetchBrief,
  } = useQuery<BriefResponse>({
    queryKey: ['market-brief'],
    queryFn: () => fetchJson<BriefResponse>('/api/news/brief', { credentials: 'include' }),
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ ok: boolean; inserted: number }>('/api/news/refresh', {
        method: 'POST',
        credentials: 'include',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['market-news'] });
      void qc.invalidateQueries({ queryKey: ['market-brief'] });
    },
  });

  const items = newsData?.items ?? [];
  const pinnedSymbols = newsData?.pinnedSymbols ?? ['NIFTY', 'BANKNIFTY'];
  const brief = briefData?.brief;

  const sentimentBadge = (s: string) => {
    if (s === 'BULLISH') return <Badge variant="success">BULLISH</Badge>;
    if (s === 'BEARISH') return <Badge variant="danger">BEARISH</Badge>;
    return <Badge variant="default">NEUTRAL</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-sky-400" />
            Market Pulse &amp; AI News Feed
          </h2>
          <p className="text-sm text-slate-400">
            Watchlist-filtered market news, event classification, and AI strategy regime guidance
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {refreshMutation.isPending ? 'Syncing Feeds…' : 'Sync News & AI Brief'}
        </Button>
      </div>

      {briefError && (
        <QueryErrorState error={briefError} onRetry={() => void refetchBrief()} title="AI Market Brief unavailable" />
      )}
      {newsError && (
        <QueryErrorState error={newsError} onRetry={() => void refetchNews()} title="News feed unavailable" />
      )}

      {brief && (
        <Card className="border-sky-500/30 bg-gradient-to-br from-slate-900/90 to-sky-950/20">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="info">{brief.briefType.replace('_', ' ')}</Badge>
                <Badge variant={brief.marketRegime === 'HIGH_VOLATILITY' ? 'warning' : 'success'}>
                  Regime: {brief.marketRegime}
                </Badge>
                <span className="text-xs text-slate-400 font-mono">{brief.istDate} IST</span>
              </div>
              <CardTitle className="text-lg text-white pt-1">{brief.headline}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(brief.watchlistHighlights ?? []).slice(0, 6).map((h) => (
                <div
                  key={h.symbol}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-white">{h.symbol}</span>
                    {sentimentBadge(h.sentiment)}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{h.topHeadline}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          className="w-auto text-xs"
        >
          <option value="ALL">All Symbols</option>
          {pinnedSymbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Select
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value)}
          className="w-auto text-xs"
        >
          <option value="ALL">All Sentiment</option>
          <option value="BULLISH">Bullish</option>
          <option value="BEARISH">Bearish</option>
          <option value="NEUTRAL">Neutral</option>
        </Select>

        <Button
          variant={watchlistOnly ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setWatchlistOnly((v) => !v)}
        >
          {watchlistOnly ? 'Watchlist + Macro Only' : 'Showing All Market News'}
        </Button>
      </div>

      {isNewsLoading ? (
        <SkeletonTable rows={5} cols={3} />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <Newspaper className="h-8 w-8 text-slate-500 mx-auto" />
            <p className="text-sm text-slate-300">
              No news items cached yet for your watchlist. Click <strong>Sync News &amp; AI Brief</strong> to fetch live market feeds.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col justify-between">
              <CardHeader className="pb-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="info">{item.symbol ?? 'MACRO'}</Badge>
                    {sentimentBadge(item.sentiment)}
                    <Badge variant={item.impactLevel === 'HIGH' ? 'warning' : 'default'}>
                      {item.impactLevel}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(item.publishedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </span>
                </div>
                <CardTitle className="text-base leading-snug text-white">{item.title}</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  {item.source} · {item.eventType}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.summary && <p className="text-xs text-slate-300 line-clamp-2">{item.summary}</p>}
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between text-sky-300 font-medium">
                    <span className="flex items-center gap-1">
                      {item.sentiment === 'BULLISH' ? (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                      ) : item.sentiment === 'BEARISH' ? (
                        <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                      )}
                      AI Strategy Note
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{item.suggestedRegime}</span>
                  </div>
                  <p className="text-slate-300">{item.aiRationale}</p>
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                >
                  Read source <ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
