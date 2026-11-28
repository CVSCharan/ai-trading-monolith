import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, CheckCircle2, Circle, GraduationCap } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { fetchJson } from '../lib/api';

interface Lesson {
  id: string;
  title: string;
  durationMin: number;
  summary: string;
  keyTakeaways: string[];
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

interface CurriculumModule {
  id: string;
  title: string;
  level: 'Beginner' | 'Intermediate' | 'Pro Algo';
  description: string;
  lessons: Lesson[];
}

const CURRICULUM: CurriculumModule[] = [
  {
    id: 'foundations',
    title: '1. Market Foundations',
    level: 'Beginner',
    description: 'How Indian exchanges, order types, and margin products work from scratch.',
    lessons: [
      {
        id: 'exchanges-sessions',
        title: 'NSE/BSE Sessions & Market Timings',
        durationMin: 4,
        summary:
          'Indian equities & F&O trade 09:15–15:30 IST. Pre-open (09:00–09:08) discovers the opening price; avoid chasing the first 15 minutes (09:15–09:30) due to wide spreads.',
        keyTakeaways: [
          'Pre-open absorbs overnight global news before continuous trading starts at 09:15 IST.',
          'Intraday MIS positions must be squared off before broker RMS cut-off (15:00–15:15 IST).',
        ],
        quiz: {
          question: 'Why does the AI Trader engine block new entries during 09:15–09:30 IST?',
          options: [
            'Exchanges are closed until 09:30 IST',
            'Opening volatility causes wide bid-ask spreads and false EMA crossovers',
            'Brokerage is doubled before 09:30 IST',
          ],
          correctIndex: 1,
          explanation: 'Opening bell order-book imbalances create wide spreads and whipsaws.',
        },
      },
      {
        id: 'order-types',
        title: 'Market, Limit, SL & SL-M Orders',
        durationMin: 5,
        summary:
          'A Market order guarantees fill but risks severe slippage in illiquid options. A Limit order caps your worst fill price. Stop-Loss (SL) uses a trigger + limit price to protect exits.',
        keyTakeaways: [
          'Never use naked MARKET orders in deep OTM/weekly options — always use protected LIMIT orders.',
          'Your Live Engine places LIMIT orders with a 1–2% slippage buffer for safety.',
        ],
        quiz: {
          question: 'Which order type protects you against sudden option premium spikes on entry?',
          options: ['Market Order', 'Protected Limit Order', 'After-Market Order (AMO)'],
          correctIndex: 1,
          explanation: 'A Limit Order sets a hard ceiling on buy price (or floor on sell price).',
        },
      },
      {
        id: 'mis-vs-nrml',
        title: 'MIS (Intraday) vs NRML / CNC',
        durationMin: 4,
        summary:
          'MIS is intraday-only and auto-squared off before close. NRML (F&O) and CNC (Cash Equity) allow overnight holding—which exposes you to overnight gap risk.',
        keyTakeaways: [
          'Intraday algos use MIS and force square-off at 15:00 IST to eliminate overnight gap risk.',
        ],
        quiz: {
          question: 'What happens to an open MIS position if you forget to close it before 15:15 IST?',
          options: [
            'It converts to CNC automatically for free',
            'The broker RMS auto-squares it off, often at market price with a penalty',
            'It stays open until next week',
          ],
          correctIndex: 1,
          explanation: 'Brokers force-liquidate open MIS positions before market close.',
        },
      },
    ],
  },
  {
    id: 'price-action',
    title: '2. Candlesticks & Price Action',
    level: 'Beginner',
    description: 'Reading OHLC candles, market structure, and volume confirmation.',
    lessons: [
      {
        id: 'ohlc-anatomy',
        title: 'Candle Anatomy (OHLC) & Closed Bars',
        durationMin: 5,
        summary:
          'Each candle shows Open, High, Low, Close. An unclosed candle can flip bullish to bearish mid-minute; professional algos only evaluate signals on CLOSED bars.',
        keyTakeaways: [
          'Long wicks indicate rejection; strong bodies near the high/low show conviction.',
          'Never trigger an entry on an unclosed live tick inside a forming 15m bar.',
        ],
        quiz: {
          question: 'Why must signals be evaluated only when a bar closes?',
          options: [
            'To avoid repainting/whipsaw signals from intra-bar price fluctuations',
            'Because brokers only accept orders every 15 minutes',
            'To reduce STT',
          ],
          correctIndex: 0,
          explanation: 'Intra-bar EMA crossovers can appear and disappear before the candle closes.',
        },
      },
      {
        id: 'support-resistance',
        title: 'Support, Resistance & Breakouts',
        durationMin: 5,
        summary:
          'Previous day high/low (PDH/PDL) and opening range levels act as liquidity magnets. True breakouts expand on above-average volume.',
        keyTakeaways: [
          'False breakouts trap retail buyers when volume is weak.',
          'Wait for candle close beyond the level or a clean retest.',
        ],
        quiz: {
          question: 'What confirms a genuine breakout above resistance?',
          options: [
            'A tiny wick poke with falling volume',
            'A strong candle close above resistance accompanied by rising volume',
            'A gap down open',
          ],
          correctIndex: 1,
          explanation: 'Strong closes with volume expansion show institutional participation.',
        },
      },
    ],
  },
  {
    id: 'risk-management',
    title: '3. Risk & Capital Management',
    level: 'Beginner',
    description: 'The math that keeps traders solvent through inevitable losing streaks.',
    lessons: [
      {
        id: 'one-percent-rule',
        title: 'The 1–2% Rule & Max Daily Loss',
        durationMin: 5,
        summary:
          'Risking 1% of capital per trade means 10 consecutive losses only draw down ~9.6%. Risking 10% per trade wipes out 65% in 10 losses. A hard Daily Loss Kill-Switch prevents tilt.',
        keyTakeaways: [
          'A 50% drawdown requires a +100% gain just to break even.',
          'Configure Max Daily Loss (e.g. 2%) in Settings so the engine blocks new entries automatically.',
        ],
        quiz: {
          question: 'If your account drops 50% from ₹10L to ₹5L, what return is needed to recover to ₹10L?',
          options: ['50%', '75%', '100%'],
          correctIndex: 2,
          explanation: 'Doubling ₹5L back to ₹10L requires a +100% return.',
        },
      },
      {
        id: 'risk-reward',
        title: 'Risk-to-Reward & Expectancy',
        durationMin: 5,
        summary:
          'Win rate alone is meaningless. With a 1:2 Risk-to-Reward ratio, you only need a 34% win rate to be profitable. Expectancy = (Win% × AvgWin) − (Loss% × AvgLoss).',
        keyTakeaways: [
          'Cut losers quickly with a predefined stop-loss; let trend winners run until opposite crossover.',
        ],
        quiz: {
          question: 'With an average win of ₹6,000, average loss of ₹3,000, and 40% win rate, is expectancy positive?',
          options: [
            'Yes (+₹600 per trade)',
            'No (−₹600 per trade)',
            'Zero (breakeven)',
          ],
          correctIndex: 0,
          explanation: '(0.4 × 6000) - (0.6 × 3000) = 2400 - 1800 = +₹600 per trade.',
        },
      },
    ],
  },
  {
    id: 'technicals-algo',
    title: '4. Indicators & Algo Logic',
    level: 'Intermediate',
    description: 'EMAs, VWAP, ORB, and matching strategies to market regimes.',
    lessons: [
      {
        id: 'ema-crossover',
        title: '9/21 EMA Crossover & Continuity',
        durationMin: 5,
        summary:
          'EMA gives more weight to recent closes. When EMA9 crosses above EMA21, short-term momentum turns bullish. EMAs must run continuously across days without resetting at 09:15.',
        keyTakeaways: [
          'EMA9/21 thrives in trending markets and suffers whipsaws in sideways chop.',
          'Check Market Pulse & AI Regime before enabling aggressive size.',
        ],
        quiz: {
          question: 'In which market regime do EMA crossover strategies perform worst?',
          options: [
            'Strong directional trend days',
            'Tight sideways / rangebound chop',
            'Post-breakout momentum',
          ],
          correctIndex: 1,
          explanation: 'Sideways chop causes repeated false crossovers (whipsaws).',
        },
      },
      {
        id: 'vwap-orb',
        title: 'VWAP Pullback & Opening Range Breakout',
        durationMin: 5,
        summary:
          'VWAP is the institutional benchmark price weighted by volume. ORB captures morning range expansion after the first 15m/30m candle closes.',
        keyTakeaways: [
          'Use ORB on high-catalyst news days; use VWAP pullback for disciplined trend continuation.',
        ],
        quiz: {
          question: 'What does VWAP stand for?',
          options: [
            'Volatility Weighted Average Price',
            'Volume Weighted Average Price',
            'Variable Window Action Price',
          ],
          correctIndex: 1,
          explanation: 'VWAP weights price by traded volume across the session.',
        },
      },
    ],
  },
  {
    id: 'options-mastery',
    title: '5. Options & Greeks Mastery',
    level: 'Intermediate',
    description: 'Strike selection, Delta, Theta decay, and IV crush.',
    lessons: [
      {
        id: 'moneyness-delta',
        title: 'ITM vs ATM vs OTM & Delta',
        durationMin: 6,
        summary:
          'Deep ITM options have high Delta (0.70–0.85) and track the index closely with low Theta decay. OTM options have low Delta and lose value rapidly near expiry.',
        keyTakeaways: [
          'DEEP_ITM_BUY (ATM ± 5 strikes) mimics futures with capped option-buyer risk.',
          'Always avoid buying weekly options within 1–2 days of expiry due to accelerating Theta.',
        ],
        quiz: {
          question: 'Why does DEEP_ITM_BUY use strikes 5 steps ITM instead of OTM?',
          options: [
            'Higher Delta and much lower Theta time-decay drag',
            'OTM options have zero brokerage',
            'ITM options never lose money',
          ],
          correctIndex: 0,
          explanation: 'Deep ITM options carry mostly intrinsic value, minimizing Theta decay.',
        },
      },
      {
        id: 'iv-crush',
        title: 'Implied Volatility (IV) & Event Crush',
        durationMin: 5,
        summary:
          'Before major events (RBI, Budget, Earnings), option premiums inflate with high IV. Right after the announcement, IV collapses ("IV Crush"), hurting option buyers even if direction is right.',
        keyTakeaways: [
          'Use Market Pulse to spot HIGH impact events before buying naked options.',
        ],
        quiz: {
          question: 'What happens to option buyers immediately after an anticipated earnings result if IV collapses?',
          options: [
            'Option premiums can drop even if the stock moves modestly in their favor',
            'Option premiums automatically double',
            'Theta becomes positive for buyers',
          ],
          correctIndex: 0,
          explanation: 'Vega loss from IV crush can offset Delta gains.',
        },
      },
    ],
  },
  {
    id: 'algo-discipline',
    title: '6. Algo & Backtest Discipline',
    level: 'Pro Algo',
    description: 'Avoiding backtest traps and graduating safely from Paper to Live.',
    lessons: [
      {
        id: 'backtest-realism',
        title: 'Slippage, STT & Overfitting Traps',
        durationMin: 5,
        summary:
          'A backtest without brokerage, 0.1% sell-side STT, stamp duty, and bid-ask slippage is fiction. Always verify out-of-sample dates and inspect individual fills in Trade Auditor.',
        keyTakeaways: [
          'Inspect worst-case drawdown and consecutive losses, not just net profit.',
        ],
        quiz: {
          question: 'Which cost is charged ONLY on the SELL side of NSE options?',
          options: ['Stamp Duty', 'Securities Transaction Tax (STT)', 'GST'],
          correctIndex: 1,
          explanation: 'STT applies on the sell leg of options; Stamp Duty applies on the buy leg.',
        },
      },
      {
        id: 'paper-to-live',
        title: '7-Gate Live Graduation & Trade Journaling',
        durationMin: 4,
        summary:
          'Before enabling real capital, pass all 7 server gates (100+ paper trades, Profit Factor > 1.5, Max DD < 10%, 2FA, Broker Sync) and journal every live trade.',
        keyTakeaways: [
          'Use the Trade Journal in Trade Auditor to track rule adherence vs FOMO.',
        ],
        quiz: {
          question: 'What is the minimum Paper Profit Factor required by the Live Trading gate?',
          options: ['> 1.0', '> 1.5', '> 3.0'],
          correctIndex: 1,
          explanation: 'The Live Trading gate requires Profit Factor > 1.5 and Max Drawdown < 10%.',
        },
      },
    ],
  },
];

interface ProgressRow {
  moduleId: string;
  lessonId: string;
  quizScore: number;
}

export function ZeroToTraderCurriculum() {
  const qc = useQueryClient();
  const [selectedModuleId, setSelectedModuleId] = useState(CURRICULUM[0].id);
  const [selectedLessonId, setSelectedLessonId] = useState(CURRICULUM[0].lessons[0].id);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: progressData } = useQuery<{ items: ProgressRow[] }>({
    queryKey: ['academy-progress'],
    queryFn: () => fetchJson<{ items: ProgressRow[] }>('/api/academy/progress', { credentials: 'include' }),
  });

  const completeMutation = useMutation({
    mutationFn: (payload: { moduleId: string; lessonId: string; quizScore: number }) =>
      fetchJson('/api/academy/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['academy-progress'] }),
  });

  const completedSet = new Set(
    (progressData?.items ?? []).map((i) => `${i.moduleId}:${i.lessonId}`)
  );
  const totalLessons = CURRICULUM.reduce((s, m) => s + m.lessons.length, 0);
  const completedCount = completedSet.size;
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const currentModule = CURRICULUM.find((m) => m.id === selectedModuleId) ?? CURRICULUM[0];
  const currentLesson =
    currentModule.lessons.find((l) => l.id === selectedLessonId) ?? currentModule.lessons[0];

  const handleSelectLesson = (modId: string, lessonId: string) => {
    setSelectedModuleId(modId);
    setSelectedLessonId(lessonId);
    setSelectedOption(null);
    setQuizFeedback(null);
  };

  const handleSubmitQuiz = () => {
    if (selectedOption === null) return;
    const isCorrect = selectedOption === currentLesson.quiz.correctIndex;
    if (isCorrect) {
      setQuizFeedback({
        ok: true,
        text: `Correct! ${currentLesson.quiz.explanation}`,
      });
      completeMutation.mutate({
        moduleId: currentModule.id,
        lessonId: currentLesson.id,
        quizScore: 100,
      });
    } else {
      setQuizFeedback({
        ok: false,
        text: `Not quite — ${currentLesson.quiz.explanation} Try again!`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/30 bg-slate-900/70">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-4 space-y-0 pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-white">
              <GraduationCap className="h-5 w-5 text-emerald-400" />
              Zero-to-Trader Mastery Path
            </CardTitle>
            <CardDescription>
              Complete all 6 tracks &amp; pass each lesson check to build disciplined trading habits
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={pct === 100 ? 'success' : 'info'} className="gap-1">
              <Award className="h-3.5 w-3.5" />
              {completedCount} / {totalLessons} Lessons ({pct}%)
            </Badge>
            <Link to="/paper-trading">
              <Button variant="outline" size="sm" className="gap-1">
                Practice in Paper Desk <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={pct} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          {CURRICULUM.map((mod) => (
            <Card key={mod.id} className="bg-slate-900/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm text-white">{mod.title}</CardTitle>
                  <Badge variant="default" className="text-[10px]">
                    {mod.level}
                  </Badge>
                </div>
                <CardDescription className="text-xs">{mod.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {mod.lessons.map((lesson) => {
                  const done = completedSet.has(`${mod.id}:${lesson.id}`);
                  const active = mod.id === currentModule.id && lesson.id === currentLesson.id;
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => handleSelectLesson(mod.id, lesson.id)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                        active
                          ? 'bg-sky-500/20 text-white border border-sky-500/40'
                          : 'text-slate-300 hover:bg-slate-800/70'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        )}
                        <span className="truncate">{lesson.title}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                        {lesson.durationMin}m
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="lg:col-span-2 h-fit">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <Badge variant="info">{currentModule.title}</Badge>
              {completedSet.has(`${currentModule.id}:${currentLesson.id}`) && (
                <Badge variant="success">Completed</Badge>
              )}
            </div>
            <CardTitle className="text-xl text-white pt-1">{currentLesson.title}</CardTitle>
            <CardDescription>{currentLesson.durationMin} min read + knowledge check</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-slate-200 leading-relaxed">{currentLesson.summary}</p>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                Key Trader Rules
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300">
                {currentLesson.keyTakeaways.map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Quick Check
              </div>
              <p className="text-sm font-medium text-white">{currentLesson.quiz.question}</p>
              <div className="space-y-2">
                {currentLesson.quiz.options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedOption(idx)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      selectedOption === idx
                        ? 'border-sky-400 bg-sky-500/15 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmitQuiz}
                  disabled={selectedOption === null || completeMutation.isPending}
                >
                  Verify &amp; Mark Complete
                </Button>
                {quizFeedback && (
                  <span
                    className={`text-xs ${
                      quizFeedback.ok ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {quizFeedback.text}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
