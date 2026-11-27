import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { TradeCandlestickChart, type ChartCandle } from '../components/charts/TradeCandlestickChart';
import { Button } from '../components/ui/button';
import { Skeleton, SkeletonChart, SkeletonTable } from '../components/ui/skeleton';
import { TradeContextPanel } from '../components/TradeContextPanel';
import { QueryErrorState } from '../components/ui/query-feedback';
import { fetchJson } from '../lib/api';

interface TradeRecord {
  id: string;
  tradeNum: number;
  symbol: string;
  optionSymbol: string;
  side: 'LONG' | 'SHORT';
  entryTime: string;
  entryPrice: string;
  exitTime?: string;
  exitPrice?: string;
  quantity: number;
  grossPnl?: string;
  costs?: string;
  netPnl?: string;
  exitReason?: string;
}

export function TradeAuditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: chartRes, isLoading, error, refetch } = useQuery<{
    trade: TradeRecord;
    candles: ChartCandle[];
  }>({
    queryKey: ['trade-chart', id],
    enabled: Boolean(id),
    queryFn: async () => {
      return fetchJson<{ trade: TradeRecord; candles: ChartCandle[] }>(`/api/trades/${encodeURIComponent(id!)}/chart-data`, { credentials: 'include' });
    },
  });

  const { data: adjacent } = useQuery<{ prevId: string | null; nextId: string | null }>({
    queryKey: ['trade-adjacent', id],
    enabled: Boolean(id),
    queryFn: async () => {
      return fetchJson<{ prevId: string | null; nextId: string | null }>(`/api/trades/${encodeURIComponent(id!)}/adjacent`, { credentials: 'include' });
    },
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && adjacent?.prevId) {
        navigate(`/trade-auditor/${adjacent.prevId}`);
      } else if (e.key === 'ArrowRight' && adjacent?.nextId) {
        navigate(`/trade-auditor/${adjacent.nextId}`);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adjacent, navigate]);

  if (!id) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Trade Auditor</h2>
        <p className="mt-2 text-sm text-slate-400">
          Select a trade from <span className="text-sky-400">Backtests</span> to inspect its 1m candlestick chart, EMA9/EMA21 overlay, and execution costs.
        </p>
      </div>
    );
  }

  const trade = chartRes?.trade;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">
            Trade Auditor {trade ? `#${trade.tradeNum} · ${trade.optionSymbol}` : ''}
          </h2>
          <p className="text-xs text-slate-400">Use ← / → arrow keys to step between trades</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!adjacent?.prevId}
            onClick={() => adjacent?.prevId && navigate(`/trade-auditor/${adjacent.prevId}`)}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!adjacent?.nextId}
            onClick={() => adjacent?.nextId && navigate(`/trade-auditor/${adjacent.nextId}`)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SkeletonChart height="h-[420px]" />
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
            <Skeleton className="h-5 w-32" />
            <SkeletonTable rows={6} cols={2} />
          </div>
        </div>
      )}
      {error && !isLoading && <QueryErrorState error={error} onRetry={() => void refetch()} title="Trade details are unavailable" />}

      {trade && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TradeCandlestickChart
              candles={chartRes?.candles ?? []}
              entryTime={trade.entryTime}
              exitTime={trade.exitTime}
              side={trade.side}
            />
          </div>

          <TradeContextPanel
            trade={{
              id: trade.id,
              symbol: trade.symbol,
              optionSymbol: trade.optionSymbol,
              side: trade.side,
              quantity: trade.quantity,
              entryPrice: trade.entryPrice,
              exitPrice: trade.exitPrice,
              grossPnl: trade.grossPnl,
              totalCosts: trade.costs,
              netPnl: trade.netPnl,
              closedReason: trade.exitReason,
            }}
          />
        </div>
      )}
    </div>
  );
}
