import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export interface SignalFeedItem {
  id: string;
  symbol: string;
  signalType: string;
  price?: number;
  time: string;
}

export function SignalFeed({ signals }: { signals: SignalFeedItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recent 9/21 EMA Signals</CardTitle>
        <Badge variant="info">IST</Badge>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <p className="text-xs text-slate-400">
            No live crossover signals in this session yet. Start Paper Trading or run a Backtest.
          </p>
        ) : (
          <div className="space-y-2.5">
            {signals.slice(0, 6).map((sig) => {
              const isBull = sig.signalType.includes('LONG') || sig.signalType.includes('BUY');
              return (
                <div
                  key={sig.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-mono font-medium text-slate-100">{sig.symbol}</div>
                    <div className="text-slate-500">{sig.time}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant={isBull ? 'success' : 'danger'}>{sig.signalType}</Badge>
                    {sig.price !== undefined && (
                      <div className="mt-1 font-mono tabular-nums text-slate-300">
                        ₹{sig.price.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
