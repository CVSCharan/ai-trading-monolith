import { useState, useEffect } from 'react';

const STATUS_MESSAGES = [
  'Connecting to trading engine...',
  'Verifying cryptographic session...',
  'Synchronizing multi-market registry...',
  'Initializing algorithmic feeds...',
];

interface InitialLoaderProps {
  message?: string;
}

export function InitialLoader({ message }: InitialLoaderProps) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (message) return;
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [message]);

  const activeMessage = message ?? STATUS_MESSAGES[msgIndex];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden select-none">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-sky-500/10 via-indigo-500/10 to-emerald-500/10 blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-cyan-500/5 blur-2xl" />
      </div>

      {/* Glassmorphic terminal card */}
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-800/80 bg-slate-900/60 p-8 backdrop-blur-2xl shadow-[0_0_60px_-15px_rgba(14,165,233,0.18)] flex flex-col items-center gap-6">
        {/* Animated logo glyph with pulsing orbital rings */}
        <div className="relative flex items-center justify-center">
          {/* Orbital pulse ring */}
          <span className="absolute -inset-3 rounded-2xl border border-cyan-500/20 animate-ping opacity-35" />
          <span className="absolute -inset-1.5 rounded-2xl border border-sky-400/30 animate-pulse" />

          {/* Logo container */}
          <div className="relative h-16 w-16 rounded-2xl bg-slate-900/90 border border-slate-700/80 p-2.5 shadow-inner flex items-center justify-center">
            <img src="/logo.svg" alt="AI Trader Logo" className="h-full w-full object-contain drop-shadow" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 ring-2 ring-slate-950" />
            </span>
          </div>
        </div>

        {/* Brand identity */}
        <div className="text-center space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-lg font-bold tracking-widest uppercase bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              AI Trader
            </h1>
            <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-cyan-300">
              QUANT
            </span>
          </div>
          <p className="text-[11px] font-medium tracking-wide uppercase text-slate-400">
            Options &amp; Multi-Broker Terminal
          </p>
        </div>

        {/* High-speed laser loading bar */}
        <div className="w-full space-y-2 pt-1">
          <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden relative">
            <div
              className="absolute top-0 bottom-0 w-2/5 bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 rounded-full animate-[shimmer_1.8s_cubic-bezier(0.4,0,0.2,1)_infinite]"
              style={{
                animation: 'loaderSlide 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tracking-tight h-4">
            <span className="truncate transition-opacity duration-300">{activeMessage}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider shrink-0 ml-2">LIVE</span>
          </div>
        </div>

        {/* Security badges & exchanges footer */}
        <div className="pt-2 border-t border-slate-800/60 w-full flex items-center justify-between text-[10px] text-slate-400 tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            NSE · BSE · MCX
          </span>
          <span className="font-mono text-slate-400">AES-256 GCM</span>
        </div>
      </div>

      <style>{`
        @keyframes loaderSlide {
          0% { left: -40%; width: 30%; }
          50% { left: 40%; width: 50%; }
          100% { left: 100%; width: 30%; }
        }
      `}</style>
    </div>
  );
}
