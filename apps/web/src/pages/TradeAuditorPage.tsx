import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { TradeCandlestickChart, type ChartCandle } from '../components/charts/TradeCandlestickChart';

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

  const { data: chartRes, isLoading, error } = useQuery<{
    trade: TradeRecord;
    candles: ChartCandle[];
  }>({
    queryKey: ['trade-chart', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/trades/${id}/chart-data`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load trade chart data');
      return res.json();
    },
  });

  const { data: adjacent } = useQuery<{ prevId: string | null; nextId: string | null }>({
    queryKey: ['trade-adjacent', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/trades/${id}/adjacent`, { credentials: 'include' });
      if (!res.ok) return { prevId: null, nextId: null };
      return res.json();
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
          <button
            disabled={!adjacent?.prevId}
            onClick={() => adjacent?.prevId && navigate(`/trade-auditor/${adjacent.prevId}`)}
            className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            disabled={!adjacent?.nextId}
            onClick={() => adjacent?.nextId && navigate(`/trade-auditor/${adjacent.nextId}`)}
            className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && <div className="text-sm text-slate-400">Loading chart data...</div>}
      {error && <div className="text-sm text-red-400">Sign in and select a valid trade ID to inspect.</div>}

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

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm">
            <h3 className="font-semibold text-white">Execution Context</h3>
            <div className="flex justify-between text-slate-300">
              <span>Side / Qty</span>
              <span>{trade.side} · {trade.quantity}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Entry Price</span>
              <span>₹{Number(trade.entryPrice).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Exit Price</span>
              <span>{trade.exitPrice ? `₹${Number(trade.exitPrice).toFixed(2)}` : '—'}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Gross P&amp;L</span>
              <span>₹{Number(trade.grossPnl ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Total Costs</span>
              <span className="text-amber-400">₹{Number(trade.costs ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2 font-semibold">
              <span>Net P&amp;L</span>
              <span className={Number(trade.netPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                ₹{Number(trade.netPnl ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Exit Reason</span>
              <span>{trade.exitReason ?? '—'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
