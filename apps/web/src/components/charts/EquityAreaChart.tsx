import { useState } from 'react';

export interface EquityPoint {
  label: string;
  equity: number;
}

export function EquityAreaChart({ data }: { data: EquityPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-500">
        No equity points available yet.
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const padX = 16;
  const padY = 18;
  const values = data.map((d) => d.equity);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = Math.max(1, maxVal - minVal);

  const points = data.map((d, idx) => {
    const x =
      data.length === 1
        ? width / 2
        : padX + (idx / (data.length - 1)) * (width - padX * 2);
    const y =
      height - padY - ((d.equity - minVal) / span) * (height - padY * 2);
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(height - padY).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height - padY).toFixed(1)} Z`;

  const active = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1];

  return (
    <div className="relative h-full w-full">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>{active.label}</span>
        <span className="font-mono font-semibold tabular-nums text-emerald-400">
          ₹{active.equity.toLocaleString('en-IN')}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[calc(100%-24px)] w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="aiTraderEqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#aiTraderEqGrad)" />
        <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={`${p.label}-${i}`}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === i ? 5 : 3}
            fill={hoverIdx === i ? '#34d399' : '#10b981'}
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}
      </svg>
    </div>
  );
}
