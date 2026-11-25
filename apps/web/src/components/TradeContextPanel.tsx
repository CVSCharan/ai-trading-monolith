import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export interface TradeContextData {
  id: string;
  symbol?: string;
  optionSymbol?: string;
  optionType?: string;
  strikePrice?: number | string;
  expiryDate?: string;
  side?: string;
  quantity?: number;
  entryPrice?: number | string;
  exitPrice?: number | string;
  grossPnl?: number | string;
  totalCosts?: number | string;
  netPnl?: number | string;
  closedReason?: string;
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    iv?: number;
  };
  costsBreakdown?: {
    brokerage?: number;
    stt?: number;
    exchangeTxn?: number;
    sebi?: number;
    stampDuty?: number;
    gst?: number;
  };
}

export function TradeContextPanel({ trade }: { trade: TradeContextData | null }) {
  if (!trade) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Option &amp; Cost Context</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-400">
          Select a trade to inspect strike details, Greeks, and Groww F&amp;O cost breakdown.
        </CardContent>
      </Card>
    );
  }

  const net = Number(trade.netPnl ?? 0);
  const gross = Number(trade.grossPnl ?? 0);
  const totalCosts = Number(trade.totalCosts ?? Math.max(0, gross - net));
  const greeks = trade.greeks ?? {};
  const costs = trade.costsBreakdown ?? {};

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Contract &amp; Execution</CardTitle>
          <Badge variant={net >= 0 ? 'success' : 'danger'}>
            {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Contract</span>
            <span className="font-mono font-medium text-slate-100">
              {trade.optionSymbol ?? trade.symbol ?? '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Strike / Type</span>
            <span className="font-mono text-slate-200">
              {trade.strikePrice ?? '—'} {trade.optionType ?? ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Side &amp; Qty</span>
            <span className="font-mono text-slate-200">
              {trade.side ?? 'BUY'} · {trade.quantity ?? '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Entry → Exit</span>
            <span className="font-mono tabular-nums text-slate-200">
              ₹{Number(trade.entryPrice ?? 0).toFixed(2)} → ₹{Number(trade.exitPrice ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Exit Reason</span>
            <Badge variant="info">{trade.closedReason ?? 'SIGNAL'}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Greeks &amp; IV Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <div className="text-slate-400">Delta (Δ)</div>
            <div className="font-mono tabular-nums text-slate-100">
              {greeks.delta !== undefined ? greeks.delta.toFixed(3) : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <div className="text-slate-400">IV</div>
            <div className="font-mono tabular-nums text-slate-100">
              {greeks.iv !== undefined ? `${greeks.iv.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <div className="text-slate-400">Theta (Θ)</div>
            <div className="font-mono tabular-nums text-slate-100">
              {greeks.theta !== undefined ? greeks.theta.toFixed(2) : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <div className="text-slate-400">Gamma / Vega</div>
            <div className="font-mono tabular-nums text-slate-100">
              {greeks.gamma !== undefined ? greeks.gamma.toFixed(4) : '—'} /{' '}
              {greeks.vega !== undefined ? greeks.vega.toFixed(2) : '—'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>F&amp;O Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Gross P&amp;L</span>
            <span className="font-mono tabular-nums text-slate-200">₹{gross.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Brokerage</span>
            <span className="font-mono tabular-nums text-slate-300">
              ₹{Number(costs.brokerage ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">STT + Exchange + Stamp</span>
            <span className="font-mono tabular-nums text-slate-300">
              ₹
              {(
                Number(costs.stt ?? 0) +
                Number(costs.exchangeTxn ?? 0) +
                Number(costs.stampDuty ?? 0)
              ).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-1.5 font-medium">
            <span className="text-slate-300">Total Statutory &amp; Brokerage</span>
            <span className="font-mono tabular-nums text-amber-300">-₹{totalCosts.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
