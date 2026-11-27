import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calculator,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  HelpCircle,
  Layers,
  LineChart,
  Percent,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export function TradingAcademyPage() {
  const [activeTab, setActiveTab] = useState('strategy');

  // Interactive Cross-Verification Calculator State
  const [calcIndex, setCalcIndex] = useState<'NIFTY' | 'BANKNIFTY'>('NIFTY');
  const [calcSpot, setCalcSpot] = useState(24350);
  const [calcEma9, setCalcEma9] = useState(24360);
  const [calcEma21, setCalcEma21] = useState(24340);
  const [calcPrevEma9, setCalcPrevEma9] = useState(24335);
  const [calcPrevEma21, setCalcPrevEma21] = useState(24342);
  const [calcMode, setCalcMode] = useState<'DEEP_ITM_BUY' | 'ATM_BUY' | 'ATM_SELL'>('DEEP_ITM_BUY');
  const [calcOptionPrice, setCalcOptionPrice] = useState(280);

  // Derived calculation
  const isCrossoverBullish = calcPrevEma9 <= calcPrevEma21 && calcEma9 > calcEma21;
  const isCrossoverBearish = calcPrevEma9 >= calcPrevEma21 && calcEma9 < calcEma21;
  const step = calcIndex === 'NIFTY' ? 50 : 100;
  const atmStrike = Math.round(calcSpot / step) * step;

  let selectedStrike = atmStrike;
  let optionType: 'CE' | 'PE' = 'CE';

  if (isCrossoverBullish) {
    optionType = 'CE';
    if (calcMode === 'DEEP_ITM_BUY') {
      selectedStrike = atmStrike - 5 * step;
    } else if (calcMode === 'ATM_SELL') {
      optionType = 'PE';
    }
  } else if (isCrossoverBearish) {
    optionType = 'PE';
    if (calcMode === 'DEEP_ITM_BUY') {
      selectedStrike = atmStrike + 5 * step;
    } else if (calcMode === 'ATM_SELL') {
      optionType = 'CE';
    }
  }

  const limitBufferPrice = Number((calcOptionPrice * 1.01).toFixed(2));
  const lotSize = calcIndex === 'NIFTY' ? 75 : 30;
  const totalValue = calcOptionPrice * lotSize;
  const stt = Number((totalValue * 0.001).toFixed(2));
  const exchangeFee = Number((totalValue * 0.0005).toFixed(2));
  const gst = Number(((exchangeFee + 20) * 0.18).toFixed(2));
  const stampDuty = Number((totalValue * 0.00003).toFixed(2));
  const totalCosts = Number((stt + exchangeFee + gst + stampDuty + 20).toFixed(2));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-slate-900/90 to-indigo-950/40 p-6 lg:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="info" className="gap-1 px-2.5 py-0.5">
                <BookOpen className="h-3 w-3" />
                Strategy Handbook &amp; Academy
              </Badge>
              <Badge variant="success">NSE INSP77559 Compliant</Badge>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              AI Trader Strategy &amp; Verification Handbook
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              A comprehensive quantitative reference guide covering the 9/21 EMA crossover algorithm,
              options Greeks &amp; strike selection, signal-to-trade cross-verification, and server-side risk invariants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link to="/trade-auditor">
              <Button variant="primary" size="sm" className="gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Open Trade Auditor
              </Button>
            </Link>
            <Link to="/strategy/builder">
              <Button variant="outline" size="sm" className="gap-1.5">
                <LineChart className="h-4 w-4" />
                Strategy Lab
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Tabs Curriculum */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start p-1 bg-slate-900/80 border-slate-800">
          <TabsTrigger value="strategy" className="gap-2">
            <Activity className="h-3.5 w-3.5 text-sky-400" />
            1. Strategy Mechanics
          </TabsTrigger>
          <TabsTrigger value="verification" className="gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            2. Cross-Verify Protocol
          </TabsTrigger>
          <TabsTrigger value="greeks" className="gap-2">
            <Percent className="h-3.5 w-3.5 text-amber-400" />
            3. Options Greeks
          </TabsTrigger>
          <TabsTrigger value="calculator" className="gap-2">
            <Calculator className="h-3.5 w-3.5 text-violet-400" />
            4. Interactive Verifier
          </TabsTrigger>
          <TabsTrigger value="regulatory" className="gap-2">
            <Scale className="h-3.5 w-3.5 text-rose-400" />
            5. Regulatory Invariants
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            MODULE 1: STRATEGY MECHANICS
           ========================================================================= */}
        <TabsContent value="strategy" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 space-y-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Zap className="h-5 w-5 text-amber-400" />
                  The 9/21 EMA Quantitative Options Engine
                </CardTitle>
                <CardDescription>
                  Mathematical formulation, continuous day-to-day EMA persistence, and entry boundaries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-300 leading-relaxed">
                <p>
                  The primary quantitative model in AI Trader uses a continuous <strong>9-period and 21-period Exponential Moving Average (EMA)</strong> crossover system on Indian equity indices (NIFTY 50 and NIFTY BANK).
                </p>

                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 font-mono text-xs space-y-2">
                  <div className="text-slate-400">// Continuous Exponential Moving Average Formula</div>
                  <div className="text-sky-300">EMA_today = (Close_today * α) + (EMA_yesterday * (1 - α))</div>
                  <div className="text-slate-400">where multiplier α = 2 / (Period + 1)</div>
                  <div className="text-slate-400">α_9 = 2 / (9 + 1) = 0.2000 (20% weight on newest close)</div>
                  <div className="text-slate-400">α_21 = 2 / (21 + 1) = 0.0909 (9.09% weight on newest close)</div>
                </div>

                <h3 className="text-base font-semibold text-white pt-2">Crucial Execution Window Rules</h3>
                <ul className="space-y-2.5 list-none pl-0">
                  <li className="flex items-start gap-2.5">
                    <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-100">09:15–09:30 IST Opening Buffer:</strong> High initial volatility and auction gap adjustments are skipped. No entries are accepted during the first 15 minutes.
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-100">09:30–11:30 IST Entry Window:</strong> The statistically proven window where true institutional direction establishes itself. All new positions must be initiated inside this window.
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-100">15:00 IST Mandatory Square-Off:</strong> Zero overnight risk. All open intraday MIS positions are unconditionally submitted for limit square-off with a tick-rounded buffer.
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Strike Selection Modes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-white">Strike Selection Modes</CardTitle>
                <CardDescription>Tailored risk-reward profiles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sky-300">DEEP_ITM_BUY</span>
                    <Badge variant="info">Delta ~0.85</Badge>
                  </div>
                  <p className="text-slate-400">
                    Selects ATM minus 5 strikes for Call or ATM plus 5 strikes for Put. Acts as a synthetic future with low theta decay and high spot mimicry.
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-300">ATM_BUY</span>
                    <Badge variant="success">Delta ~0.50</Badge>
                  </div>
                  <p className="text-slate-400">
                    Highest gamma sensitivity. Maximizes capital velocity during fast trend breakouts, suitable for high-momentum sessions.
                  </p>
                </div>

                <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-300">ATM_SELL</span>
                    <Badge variant="default">Short Theta</Badge>
                  </div>
                  <p className="text-slate-400">
                    Sells opposite ATM option to harvest rapid intraday time decay during sideways or directional trending markets.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =========================================================================
            MODULE 2: CROSS-VERIFICATION PROTOCOL
           ========================================================================= */}
        <TabsContent value="verification" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                Signal-to-Trade Cross-Verification Handbook
              </CardTitle>
              <CardDescription>
                A 6-point audit protocol to verify algorithmic signals against actual executed broker orders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-xs">1</div>
                    Bar-Close Timestamp
                  </div>
                  <p className="text-xs text-slate-400">
                    Signals fire strictly on the <strong>CLOSE</strong> of a bar (e.g. 09:35:00 for the 09:30–09:35 5m bar). Never intra-bar. Verify that <code className="text-slate-200">entryTime</code> exactly matches bar completion.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs">2</div>
                    Crossover Confirmation
                  </div>
                  <p className="text-xs text-slate-400">
                    For a Bullish entry: <code className="text-slate-200">EMA9 &gt; EMA21</code> on the signal bar AND <code className="text-slate-200">EMA9 &lt;= EMA21</code> on the bar immediately prior. Verify in Trade Auditor candlestick view.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-xs">3</div>
                    Option Strike Formula
                  </div>
                  <p className="text-xs text-slate-400">
                    Round spot price to the nearest index step (50 for NIFTY, 100 for BANKNIFTY). If DEEP_ITM_BUY, ensure strike is shifted by exactly 5 steps into the money.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs">4</div>
                    Limit Price Slippage Bound
                  </div>
                  <p className="text-xs text-slate-400">
                    Verify that the order was submitted as a tick-rounded <code className="text-slate-200">LIMIT</code> order with a 1% price protection buffer. Market orders are prohibited under NSE retail algo circulars.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-xs">5</div>
                    Statutory Taxes &amp; Fees
                  </div>
                  <p className="text-xs text-slate-400">
                    Check that P&amp;L reflects mandatory regulatory deductions: STT (0.1% on sell premium), Exchange fees (0.05%), GST (18%), and Stamp duty (0.003% on buy leg).
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-xs">6</div>
                    PostgreSQL Audit Trail
                  </div>
                  <p className="text-xs text-slate-400">
                    Cross-reference the <code className="text-slate-200">idempotencyKey</code> in <Link to="/audit-logs" className="text-sky-400 underline">Audit Trail</Link> to ensure zero duplicate fills were executed on the exchange.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-semibold text-white text-sm">Inspect Individual Live or Paper Trades</h4>
                  <p className="text-xs text-slate-300">
                    Use the Trade Auditor to step through trades with left/right keys and view synchronized EMA9/21 indicators and context cards.
                  </p>
                </div>
                <Link to="/trade-auditor">
                  <Button variant="primary" size="sm" className="gap-2 shrink-0">
                    Go to Trade Auditor <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            MODULE 3: OPTIONS GREEKS
           ========================================================================= */}
        <TabsContent value="greeks" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Delta (Δ)</CardTitle>
                <div className="text-xl font-bold text-sky-400">Directional Sensitivity</div>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-2">
                <p>Measures option premium change per ₹1 move in the underlying index.</p>
                <div className="space-y-1 border-t border-slate-800 pt-2 font-mono text-[11px]">
                  <div>Deep ITM: <span className="text-sky-300 font-bold">0.85 – 0.95</span></div>
                  <div>ATM: <span className="text-slate-200 font-bold">0.48 – 0.52</span></div>
                  <div>OTM: <span className="text-slate-400 font-bold">0.10 – 0.30</span></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Gamma (Γ)</CardTitle>
                <div className="text-xl font-bold text-emerald-400">Delta Acceleration</div>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-2">
                <p>The rate of change of Delta. Spikes dramatically on expiry day afternoons (0–DTE gamma hazard).</p>
                <div className="space-y-1 border-t border-slate-800 pt-2 text-[11px]">
                  <Badge variant="warning">High Gamma Risk on Expiries</Badge>
                  <p className="text-slate-400 mt-1">Our engine disarms 0-DTE entries after 14:00 to prevent sudden whip-saws.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Theta (Θ)</CardTitle>
                <div className="text-xl font-bold text-rose-400">Time Decay Decay</div>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-2">
                <p>Options bleed premium every hour. Non-linear acceleration occurs between 13:00 and 15:30 IST.</p>
                <div className="space-y-1 border-t border-slate-800 pt-2 text-[11px]">
                  <Badge variant="danger">Unconditional 15:00 Square-Off</Badge>
                  <p className="text-slate-400 mt-1">Protects long option profits from aggressive closing theta decay.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Vega (ν)</CardTitle>
                <div className="text-xl font-bold text-purple-400">Implied Volatility</div>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-2">
                <p>Option price sensitivity to a 1% change in India VIX.</p>
                <div className="space-y-1 border-t border-slate-800 pt-2 text-[11px]">
                  <Badge variant="info">IV Crush Warning</Badge>
                  <p className="text-slate-400 mt-1">VIX drops rapidly post-Budget or RBI policy announcements, slashing premiums.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =========================================================================
            MODULE 4: INTERACTIVE CROSS-VERIFICATION CALCULATOR
           ========================================================================= */}
        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Calculator className="h-5 w-5 text-violet-400" />
                Interactive Signal Cross-Verification Sandbox
              </CardTitle>
              <CardDescription>
                Simulate indicator inputs, test crossover rules, inspect selected option strikes, and view price buffers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Underlying Index</Label>
                  <Select
                    value={calcIndex}
                    onChange={(e) => setCalcIndex(e.target.value as 'NIFTY' | 'BANKNIFTY')}
                  >
                    <option value="NIFTY">NIFTY 50 (Step 50 · Lot 75)</option>
                    <option value="BANKNIFTY">BANKNIFTY (Step 100 · Lot 30)</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Spot Index Price (₹)</Label>
                  <Input
                    type="number"
                    value={calcSpot}
                    onChange={(e) => setCalcSpot(Number(e.target.value))}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Execution Mode</Label>
                  <Select
                    value={calcMode}
                    onChange={(e) => setCalcMode(e.target.value as any)}
                  >
                    <option value="DEEP_ITM_BUY">DEEP_ITM_BUY (Delta ~0.85)</option>
                    <option value="ATM_BUY">ATM_BUY (Delta ~0.50)</option>
                    <option value="ATM_SELL">ATM_SELL (Short Theta)</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Option Premium LTP (₹)</Label>
                  <Input
                    type="number"
                    value={calcOptionPrice}
                    onChange={(e) => setCalcOptionPrice(Number(e.target.value))}
                    className="font-mono text-emerald-400"
                  />
                </div>
              </div>

              {/* Indicator Values */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Crossover Indicator Matrix (Current Bar vs Previous Bar)
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block mb-1">Previous EMA(9):</span>
                    <Input
                      type="number"
                      value={calcPrevEma9}
                      onChange={(e) => setCalcPrevEma9(Number(e.target.value))}
                      className="font-mono h-8"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Previous EMA(21):</span>
                    <Input
                      type="number"
                      value={calcPrevEma21}
                      onChange={(e) => setCalcPrevEma21(Number(e.target.value))}
                      className="font-mono h-8"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Current EMA(9):</span>
                    <Input
                      type="number"
                      value={calcEma9}
                      onChange={(e) => setCalcEma9(Number(e.target.value))}
                      className="font-mono h-8"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Current EMA(21):</span>
                    <Input
                      type="number"
                      value={calcEma21}
                      onChange={(e) => setCalcEma21(Number(e.target.value))}
                      className="font-mono h-8"
                    />
                  </div>
                </div>
              </div>

              {/* Live Evaluation Results Card */}
              <div className="rounded-xl border border-violet-500/40 bg-violet-950/20 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div>
                    <span className="text-xs text-slate-400">Algorithmic Decision:</span>
                    <div className="text-lg font-bold">
                      {isCrossoverBullish ? (
                        <span className="text-emerald-400 flex items-center gap-1.5">
                          <TrendingUp className="h-5 w-5" /> BULLISH CROSSOVER (BUY SIGNAL)
                        </span>
                      ) : isCrossoverBearish ? (
                        <span className="text-rose-400 flex items-center gap-1.5">
                          <TrendingDown className="h-5 w-5" /> BEARISH CROSSOVER (SELL SIGNAL)
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Activity className="h-5 w-5" /> NO CROSSOVER (HOLDING / NEUTRAL)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400">Contract Selected:</span>
                    <div className="text-base font-mono font-bold text-sky-300">
                      {calcIndex} {selectedStrike} {optionType}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                    <span className="text-slate-400">ATM Strike:</span>
                    <div className="text-base font-mono font-bold text-white mt-1">{atmStrike}</div>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                    <span className="text-slate-400">Marketable Limit Ceiling (+1%):</span>
                    <div className="text-base font-mono font-bold text-sky-400 mt-1">₹{limitBufferPrice}</div>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                    <span className="text-slate-400">Total Lot Capital (1 Lot):</span>
                    <div className="text-base font-mono font-bold text-amber-300 mt-1">₹{totalValue.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                    <span className="text-slate-400">Est. Regulatory Friction:</span>
                    <div className="text-base font-mono font-bold text-rose-400 mt-1">₹{totalCosts}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            MODULE 5: REGULATORY INVARIANTS
           ========================================================================= */}
        <TabsContent value="regulatory" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Scale className="h-5 w-5 text-rose-400" />
                NSE Circular INSP77559 Compliance Architecture
              </CardTitle>
              <CardDescription>
                Exchange compliance requirements for retail algorithmic automated trading
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                In accordance with National Stock Exchange of India (NSE) circulars governing algorithmic and API-based orders placed by tech-savvy retail investors, AI Trader incorporates mandatory hard-coded compliance rules:
              </p>

              <div className="grid gap-4 md:grid-cols-2 pt-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-sky-400" />
                    1. Registered Static IP Mandate
                  </div>
                  <p className="text-xs text-slate-400">
                    All API execution orders must originate from a verified public IP registered with the broker (Upstox / Groww). Dynamic home IPs are prohibited for automated execution.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    2. Mandatory Algo Order Tagging
                  </div>
                  <p className="text-xs text-slate-400">
                    Orders submitted to broker gateways must carry the <code className="text-slate-200">X-Algo-Name: AI_TRADER_921_EMA</code> header and <code className="text-slate-200">tag: ai_trader_algo</code> payload to allow audit inspection by SEBI/exchange surveillance.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                    3. Prohibition of Naked Market Orders
                  </div>
                  <p className="text-xs text-slate-400">
                    Automated retail algorithms are prohibited from issuing unhedged market orders on illiquid option strikes. AI Trader enforces tick-rounded marketable <code className="text-slate-200">LIMIT</code> orders with 1% price protection ceilings.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-rose-400" />
                    4. Operator Two-Factor Step-Up
                  </div>
                  <p className="text-xs text-slate-400">
                    Enabling live capital trading strictly requires entering a dynamic 6-digit RFC 6238 TOTP authenticator code, verified against encrypted master-key records in PostgreSQL.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
