import { useEffect, useRef } from 'react';
import { createChart, type CandlestickData, type LineData, type SeriesMarker, type Time } from 'lightweight-charts';

export interface ChartCandle {
  barTime: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
}

interface Props {
  candles: ChartCandle[];
  entryTime?: string;
  exitTime?: string;
  side?: 'LONG' | 'SHORT';
}

function computeEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    const val = values[i] ?? prev;
    prev = i === 0 ? val : (val - prev) * k + prev;
    result.push(prev);
  }
  return result;
}

export function TradeCandlestickChart({ candles, entryTime, exitTime, side }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 420,
      layout: {
        background: { color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const ema9Series = chart.addLineSeries({ color: '#38bdf8', lineWidth: 2, title: 'EMA 9' });
    const ema21Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 2, title: 'EMA 21' });

    const data: CandlestickData<Time>[] = candles.map((c) => ({
      time: Math.floor(new Date(c.barTime).getTime() / 1000) as Time,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }));

    candleSeries.setData(data);

    if (data.length > 0) {
      const closes = data.map((d) => d.close);
      const ema9 = computeEMA(closes, 9);
      const ema21 = computeEMA(closes, 21);

      const ema9Data: LineData<Time>[] = data.map((d, i) => ({
        time: d.time,
        value: ema9[i] ?? d.close,
      }));
      const ema21Data: LineData<Time>[] = data.map((d, i) => ({
        time: d.time,
        value: ema21[i] ?? d.close,
      }));

      ema9Series.setData(ema9Data);
      ema21Series.setData(ema21Data);

      const markers: SeriesMarker<Time>[] = [];
      if (entryTime) {
        markers.push({
          time: Math.floor(new Date(entryTime).getTime() / 1000) as Time,
          position: 'belowBar',
          color: '#10b981',
          shape: 'arrowUp',
          text: `ENTRY (${side ?? 'LONG'})`,
        });
      }
      if (exitTime) {
        markers.push({
          time: Math.floor(new Date(exitTime).getTime() / 1000) as Time,
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: 'EXIT',
        });
      }
      if (markers.length > 0) {
        candleSeries.setMarkers(markers);
      }
    }

    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [candles, entryTime, exitTime, side]);

  return <div ref={containerRef} className="w-full overflow-hidden rounded-xl border border-slate-800" />;
}
