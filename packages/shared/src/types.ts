// ============================================
// Shared Type Definitions
// ============================================

import type {
  Timeframe,
  ExecutionMode,
  SignalType,
  TradeSide,
  OrderSide,
  ExitReason,
  RunType,
  OrderStatus,
  OrderType,
  OptionType,
  InstrumentType,
  ExpiryType,
} from './constants';

export type {
  Timeframe,
  ExecutionMode,
  SignalType,
  TradeSide,
  OrderSide,
  ExitReason,
  RunType,
  OrderStatus,
  OrderType,
  OptionType,
  InstrumentType,
  ExpiryType,
};

// ============================================
// Market Data Types
// ============================================

export interface Candle1m {
  instrumentId: number;
  barTime: Date;           // Bar OPEN time (aligned to IST)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;             // Open Interest
  bid?: number;            // For realistic fill simulation
  ask?: number;
}

export interface CandleResampled {
  instrumentId: number;
  timeframe: Timeframe;
  barTime: Date;           // Aligned to 09:15 IST
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

export interface Instrument {
  id: number;
  symbol: string;
  instrumentType: InstrumentType;
  lotSize: number;
  tickSize: number;
  strikeStep: number;
  underlyingSymbol?: string;
  strikePrice?: number;
  optionType?: OptionType;
  expiryDate?: Date;
  expiryType?: ExpiryType;
  validFrom: Date;
  validTo: Date | null;
  growwToken: string;
  isActive: boolean;
}

// ============================================
// Strategy Configuration
// ============================================

export interface CostConfig {
  id?: number;
  effectiveFrom: string;           // ISO date
  effectiveTo?: string;
  brokeragePerOrder: number;       // 20
  sttPct: number;                  // 0.001 = 0.1% (sell side premium)
  exchangePct: number;             // 0.0005
  gstPct: number;                  // 0.18
  sebiPerCrore: number;            // 10
  stampPct: number;                // 0.00003 (buy side)
  defaultSpreadPct?: number;       // For modelled data
  slippageSpreadFraction: number;  // 0.5 = 50% of spread
  createdAt: Date;
}

export interface RiskConfig {
  maxDailyLossPct: number;           // 2
  maxPositions: number;              // 3 (account level)
  maxPositionsPerStrategy: number;   // 1
  perTradeRiskPct: number;           // 1
  blockedPeriods: string[];          // ["09:15-09:30", "15:15-15:30"]
  shortOptionStopLossPct: number;    // 100 (premium doubles)
}

export interface StrategyConfig {
  id?: string;
  name: string;
  underlyingSymbol: 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY';
  timeframe: Timeframe;
  entryWindow: {
    start: string;  // "HH:mm" e.g., "09:30"
    end: string;    // "HH:mm" e.g., "11:30"
  };
  exitTime: string;  // "15:00"
  executionMode: ExecutionMode;
  strikeOffset: number;     // Strikes from ATM (5 = 250 pts for NIFTY)
  lots: number;             // 1
  expiryPreference: 'WEEKLY' | 'MONTHLY';
  avoidExpiryDays: number;  // 2
  risk: RiskConfig;
  costConfigId?: number;    // References cost_configs table
}

// ============================================
// Signal & Trade Types
// ============================================

export interface Signal {
  strategyId: string;
  runType: RunType;
  barTime: Date;              // Signal bar CLOSE time (IST)
  signalType: SignalType;
  ema9: number;
  ema21: number;
  spotPrice: number;
  selectedStrike: number;
  optionType: OptionType;
  optionSymbol: string;       // Groww token
  expiryDate: Date;
  entryWindowValid: boolean;
  isReversal: boolean;
  currentPosition: TradeSide | null;
  metadata: Record<string, unknown>;
}

export interface TradeBase {
  signalId?: string;
  optionSymbol: string;
  side: TradeSide;
  entryTime: Date;
  entryPrice: number;         // Fill price (bid/ask)
  exitTime?: Date;
  exitPrice?: number;
  quantity: number;           // lots * lotSize
  grossPnl?: number;
  costs?: number;
  netPnl?: number;
  exitReason?: ExitReason;
  fillMetadata: {
    bid: number;
    ask: number;
    spread: number;
    slippage: number;
  };
  metadata: Record<string, unknown>;
}

export interface Position {
  optionSymbol: string;
  side: TradeSide;
  quantity: number;
  avgEntryPrice: number;
  currentPrice?: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export interface PortfolioState {
  cashBalance: number;
  totalValue: number;
  dailyPnl: number;
  positions: Position[];
}

// ============================================
// Backtest Types
// ============================================

export interface BacktestConfig {
  strategyId: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  configSnapshot: StrategyConfig;
}

export interface BacktestResult {
  runId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  finalCapital: number;
  netPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  profitFactor: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  dailyReturns: DailyReturn[];
}

export interface BacktestTrade extends TradeBase {
  tradeNum: number;
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
  drawdown: number;
}

export interface DailyReturn {
  date: Date;
  return: number;
  trades: number;
}

// ============================================
// Margin Types
// ============================================

export interface MarginRequirement {
  span: number;
  exposure: number;
  total: number;
}