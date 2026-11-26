// ============================================
// SymbolSearchInput — Live Upstox/Groww Instrument Autocomplete
// ============================================

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

export interface InstrumentSearchHit {
  symbol: string;
  name: string;
  exchange: string;
  segment: string;
  instrumentType: string;
  instrumentKey: string;
  lotSize: number;
}

interface SymbolSearchInputProps {
  value: string;
  onChange: (symbol: string, hit?: InstrumentSearchHit) => void;
  placeholder?: string;
  segment?: 'ALL' | 'EQ' | 'FO' | 'INDEX';
}

export function SymbolSearchInput({
  value,
  onChange,
  placeholder = 'Search any NSE stock, index, or option…',
  segment = 'ALL',
}: SymbolSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), 200);
    return () => clearTimeout(id);
  }, [value]);

  const { data } = useQuery<{ results: InstrumentSearchHit[] }>({
    queryKey: ['instrument-search', debounced, segment],
    enabled: open,
    queryFn: async () => {
      const qs = new URLSearchParams({ q: debounced, segment });
      const res = await fetch(`/api/instruments/search?${qs.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) return { results: [] };
      return res.json();
    },
  });

  const results = data?.results ?? [];

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        <Input
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
            setOpen(true);
          }}
          placeholder={placeholder}
          className="pl-9 font-mono"
        />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1.5 z-40 max-h-60 overflow-y-auto thin-scrollbar rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur-xl p-1.5 shadow-2xl">
            {results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400">
                Type a symbol (e.g. RELIANCE, TCS, NIFTY)…
              </div>
            ) : (
              results.map((hit) => (
                <button
                  key={hit.instrumentKey}
                  type="button"
                  onClick={() => {
                    onChange(hit.symbol, hit);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-800/80"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-white truncate">{hit.symbol}</div>
                    <div className="text-[11px] text-slate-400 truncate">{hit.name}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="info">{hit.segment}</Badge>
                    {hit.lotSize > 1 && (
                      <span className="font-mono text-[10px] text-slate-400">Lot {hit.lotSize}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
