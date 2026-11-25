// ============================================
// Signal Generation
// ============================================

import {
  Signal,
  StrategyConfig,
  CandleResampled,
  Instrument,
  Timeframe,
  ExecutionMode,
  SignalType,
  TradeSide,
  OptionType,
  RunType,
  CrossoverDirection,
} from '../types';
import { calculateEMAsForCandles } from '../indicators/ema';
import {
  detectCrossover,
  isInEntryWindow,
  isReversal,
  crossoverToSignal,
  oppositeSignal,
  signalToSide,
  shouldSquareOff,
  shouldExitOnCrossover,
} from '../indicators/crossover';
import { getBarCloseTimeIST, timeframeToMinutes } from '../indicators/resample';
import { selectStrike } from '../execution/instrument-resolver';

/**
 * Generate signals from resampled candles and strategy config
 *
 * Process:
 * 1. Calculate EMAs on spot (index) candles
 * 2. Detect crossovers on CLOSED bars
 * 3. For each bar, check exits FIRST (always honored)
 * 4. Then check entries (gated by entry window)
 * 5. Handle immediate reversals (within window only)
 * 6. Select strike/expiry for each valid signal
 *
 * Key corrections:
 * - Exits (opposite crossover, 15:00 square-off) are ALWAYS honored
 * - Position state resets on exit and at 15:00
 * - Entry window only gates NEW entries, not exits
 * - Signal time = bar CLOSE, execution at next 1m OPEN
 */
export function generateSignals(
  spotCandles: CandleResampled[],        // Index candles (NIFTY) for EMA
  optionCandles: Map<string, CandleResampled[]>, // Option candles by symbol (for reference)
  config: StrategyConfig,
  instruments: Instrument[],
  runType: RunType = 'backtest'
): Signal[] {
  // 1. Calculate EMAs on spot closes
  const { ema9, ema21 } = calculateEMAsForCandles(spotCandles);

  // 2. Detect crossovers
  const crossovers = detectCrossover(ema9, ema21);

  // 3. Generate signals with proper exit/entry logic
  const signals: Signal[] = [];
  let currentPosition: TradeSide | null = null;
  let lastSignalBarIndex = -1;

  for (let i = 0; i < crossovers.length; i++) {
    const crossover = crossovers[i];
    const barTime = spotCandles[i].barTime;
    const barCloseTime = getBarCloseTimeIST(barTime, timeframeToMinutes(config.timeframe));
    const spotPrice = spotCandles[i].close;
    const currentEMA9 = ema9[i];
    const currentEMA21 = ema21[i];

    // Check for EXITS first (always honored, not gated by entry window)
    if (currentPosition !== null) {
      // Check 15:00 square-off (highest priority)
      if (shouldSquareOff(barCloseTime, config.exitTime)) {
        // Emit EXIT signal for square-off
        signals.push(createExitSignal(
          config.id!,
          runType,
          barCloseTime,
          currentPosition,
          currentEMA9,
          currentEMA21,
          spotPrice,
          'SQUARE_OFF_1500',
          instruments,
          config
        ));
        currentPosition = null;  // Reset position
        continue;  // No new entry on square-off bar
      }

      // Check opposite crossover exit
      if (shouldExitOnCrossover(currentPosition, crossover)) {
        // Emit EXIT signal for opposite crossover
        signals.push(createExitSignal(
          config.id!,
          runType,
          barCloseTime,
          currentPosition,
          currentEMA9,
          currentEMA21,
          spotPrice,
          'OPPOSITE_CROSSOVER',
          instruments,
          config
        ));

        // Check for immediate reversal
        if (crossover !== 'NONE') {
          const newSignalType = crossoverToSignal(crossover);
          if (newSignalType) {
            const entryWindowValid = isInEntryWindow(
              barCloseTime,
              config.entryWindow.start,
              config.entryWindow.end,
              config.risk.blockedPeriods
            );

            if (entryWindowValid) {
              // REVERSAL: close old, open new in same bar
              const newPosition = signalToSide(newSignalType);
              const { strike, optionType, optionSymbol, expiryDate } = selectStrike(
                spotPrice,
                newSignalType,
                config.executionMode,
                config.strikeOffset,
                instruments,
                barCloseTime,
                config.expiryPreference,
                config.avoidExpiryDays
              );

              signals.push({
                strategyId: config.id!,
                runType,
                barTime: barCloseTime,
                signalType: newSignalType,
                ema9: currentEMA9,
                ema21: currentEMA21,
                spotPrice,
                selectedStrike: strike,
                optionType,
                optionSymbol,
                expiryDate,
                entryWindowValid: true,
                isReversal: true,
                currentPosition,  // Position BEFORE reversal
                metadata: {
                  crossoverIndex: i,
                  timeframe: config.timeframe,
                  executionMode: config.executionMode,
                  reversedFrom: currentPosition,
                  canTrade: true
                }
              });

              currentPosition = newPosition;
              continue;
            }
          }
        }

        currentPosition = null;  // Exit without reversal
        continue;
      }
    }

    // Check for NEW ENTRY (only if no position and crossover exists)
    if (currentPosition === null && crossover !== 'NONE') {
      const signalType = crossoverToSignal(crossover);
      if (!signalType) continue;

      const entryWindowValid = isInEntryWindow(
        barCloseTime,
        config.entryWindow.start,
        config.entryWindow.end,
        config.risk.blockedPeriods
      );

      if (!entryWindowValid) {
        // Signal outside window - log but don't trade
        const newPosition = signalToSide(signalType);
        const { strike, optionType, optionSymbol, expiryDate } = selectStrike(
          spotPrice,
          signalType,
          config.executionMode,
          config.strikeOffset,
          instruments,
          barCloseTime,
          config.expiryPreference,
          config.avoidExpiryDays
        );

        signals.push({
          strategyId: config.id!,
          runType,
          barTime: barCloseTime,
          signalType,
          ema9: currentEMA9,
          ema21: currentEMA21,
          spotPrice,
          selectedStrike: strike,
          optionType,
          optionSymbol,
          expiryDate,
          entryWindowValid: false,
          isReversal: false,
          currentPosition: null,
          metadata: {
            crossoverIndex: i,
            timeframe: config.timeframe,
            executionMode: config.executionMode,
            canTrade: false,
            reason: 'outside_entry_window'
          }
        });
        continue;
      }

      // Valid entry within window
      const newPosition = signalToSide(signalType);
      const { strike, optionType, optionSymbol, expiryDate } = selectStrike(
        spotPrice,
        signalType,
        config.executionMode,
        config.strikeOffset,
        instruments,
        barCloseTime,
        config.expiryPreference,
        config.avoidExpiryDays
      );

      signals.push({
        strategyId: config.id!,
        runType,
        barTime: barCloseTime,
        signalType,
        ema9: currentEMA9,
        ema21: currentEMA21,
        spotPrice,
        selectedStrike: strike,
        optionType,
        optionSymbol,
        expiryDate,
        entryWindowValid: true,
        isReversal: false,
        currentPosition: null,
        metadata: {
          crossoverIndex: i,
          timeframe: config.timeframe,
          executionMode: config.executionMode,
          canTrade: true
        }
      });

      currentPosition = newPosition;
    }
  }

  // End of day: force square-off if position still open
  if (currentPosition !== null) {
    const lastBar = spotCandles[spotCandles.length - 1];
    const lastBarClose = getBarCloseTimeIST(lastBar.barTime, timeframeToMinutes(config.timeframe));
    const lastSpotPrice = lastBar.close;
    const lastEMA9 = ema9[ema9.length - 1];
    const lastEMA21 = ema21[ema21.length - 1];

    signals.push(createExitSignal(
      config.id!,
      runType,
      lastBarClose,
      currentPosition,
      lastEMA9,
      lastEMA21,
      lastSpotPrice,
      'SQUARE_OFF_1500',
      instruments,
      config
    ));
  }

  return signals;
}

/**
 * Create an exit signal for an existing position
 */
function createExitSignal(
  strategyId: string,
  runType: RunType,
  barCloseTime: Date,
  currentPosition: TradeSide,
  ema9: number,
  ema21: number,
  spotPrice: number,
  exitReason: 'SQUARE_OFF_1500' | 'OPPOSITE_CROSSOVER',
  instruments: Instrument[],
  config: StrategyConfig
): Signal {
  // For exit signal, we need to know what option we're exiting
  // This would come from the original entry signal
  // For now, return a signal with exit metadata
  return {
    strategyId,
    runType,
    barTime: barCloseTime,
    signalType: currentPosition === 'LONG' ? 'SELL' : 'BUY',  // Opposite to close
    ema9,
    ema21,
    spotPrice,
    selectedStrike: 0,  // Would be filled from position tracking
    optionType: 'CE',   // Would be filled from position tracking
    optionSymbol: '',   // Would be filled from position tracking
    expiryDate: new Date(),  // Would be filled from position tracking
    entryWindowValid: true,  // Exits always valid
    isReversal: false,
    currentPosition,
    metadata: {
      exitReason,
      isExit: true,
      closingPosition: currentPosition,
      canTrade: true
    }
  };
}

/**
 * Streaming signal generator for live/paper trading
 * Maintains position state across bars
 */
export class StreamingSignalGenerator {
  private config: StrategyConfig;
  private instruments: Instrument[];
  private runType: RunType;
  private currentPosition: TradeSide | null = null;
  private openTradeSymbol: string = '';
  private openTradeStrike: number = 0;
  private openTradeOptionType: OptionType = 'CE';
  private openTradeExpiryDate: Date = new Date(0);
  private lastProcessedBarTime: Date | null = null;
  private currentEMA9: number = NaN;
  private currentEMA21: number = NaN;
  private prevEMA9: number = NaN;
  private prevEMA21: number = NaN;

  constructor(config: StrategyConfig, instruments: Instrument[], runType: RunType = 'live') {
    this.config = config;
    this.instruments = instruments;
    this.runType = runType;
  }

  /**
   * Process a new closed resampled bar
   * Returns array of signals (exit + optional entry/reversal)
   */
  processBar(
    bar: CandleResampled,
    prevBar: CandleResampled | null  // Previous closed bar for crossover detection
  ): Signal[] {
    const signals: Signal[] = [];

    // Update EMAs
    const emaState = this.updateEMAs(bar.close);
    if (!emaState.warmupComplete) {
      return signals; // Not ready yet
    }

    // Detect crossover using previous and current EMAs
    const crossover = this.detectCrossover(
      this.prevEMA9, this.prevEMA21,
      this.currentEMA9, this.currentEMA21
    );

    const barCloseTime = getBarCloseTimeIST(bar.barTime, timeframeToMinutes(this.config.timeframe));
    const spotPrice = bar.close;

    // Check EXITS first (always honored)
    if (this.currentPosition !== null) {
      // 15:00 square-off
      if (shouldSquareOff(barCloseTime, this.config.exitTime)) {
        signals.push(this.createExitSignal(barCloseTime, 'SQUARE_OFF_1500', spotPrice));
        this.currentPosition = null;
        this.clearOpenTrade();
        return signals;
      }

      // Opposite crossover
      if (shouldExitOnCrossover(this.currentPosition, crossover)) {
        signals.push(this.createExitSignal(barCloseTime, 'OPPOSITE_CROSSOVER', spotPrice));

        // Check reversal
        if (crossover !== 'NONE') {
          const newSignalType = crossoverToSignal(crossover);
          if (newSignalType) {
            const entryWindowValid = isInEntryWindow(
              barCloseTime,
              this.config.entryWindow.start,
              this.config.entryWindow.end,
              this.config.risk.blockedPeriods
            );

            if (entryWindowValid) {
              const newPosition = signalToSide(newSignalType);
              const { strike, optionType, optionSymbol, expiryDate } = selectStrike(
                spotPrice,
                newSignalType,
                this.config.executionMode,
                this.config.strikeOffset,
                this.instruments,
                barCloseTime,
                this.config.expiryPreference,
                this.config.avoidExpiryDays
              );

              signals.push({
                strategyId: this.config.id!,
                runType: this.runType,
                barTime: barCloseTime,
                signalType: newSignalType,
                ema9: this.currentEMA9,
                ema21: this.currentEMA21,
                spotPrice,
                selectedStrike: strike,
                optionType,
                optionSymbol,
                expiryDate,
                entryWindowValid: true,
                isReversal: true,
                currentPosition: this.currentPosition,
                metadata: {
                  reversedFrom: this.currentPosition,
                  canTrade: true
                }
              });

              this.currentPosition = newPosition;
              this.setOpenTrade(strike, optionType, optionSymbol, expiryDate);
              return signals;
            }
          }
        }

        this.currentPosition = null;
        this.clearOpenTrade();
        return signals;
      }
    }

    // Check NEW ENTRY
    if (this.currentPosition === null && crossover !== 'NONE') {
      const signalType = crossoverToSignal(crossover);
      if (!signalType) return signals;

      const entryWindowValid = isInEntryWindow(
        barCloseTime,
        this.config.entryWindow.start,
        this.config.entryWindow.end,
        this.config.risk.blockedPeriods
      );

      if (!entryWindowValid) {
        // Log signal but don't trade
        return signals;
      }

      const newPosition = signalToSide(signalType);
      const { strike, optionType, optionSymbol, expiryDate } = selectStrike(
        spotPrice,
        signalType,
        this.config.executionMode,
        this.config.strikeOffset,
        this.instruments,
        barCloseTime,
        this.config.expiryPreference,
        this.config.avoidExpiryDays
      );

      signals.push({
        strategyId: this.config.id!,
        runType: this.runType,
        barTime: barCloseTime,
        signalType,
        ema9: this.currentEMA9,
        ema21: this.currentEMA21,
        spotPrice,
        selectedStrike: strike,
        optionType,
        optionSymbol,
        expiryDate,
        entryWindowValid: true,
        isReversal: false,
        currentPosition: null,
        metadata: { canTrade: true }
      });

      this.currentPosition = newPosition;
      this.setOpenTrade(strike, optionType, optionSymbol, expiryDate);
    }

    return signals;
  }

  private updateEMAs(close: number) {
    const mult9 = 2 / 10;
    const mult21 = 2 / 22;

    if (isNaN(this.currentEMA9)) {
      // First values - need to seed
      // In practice, this would be initialized from historical data
      // For streaming, we'd pass in pre-seeded EMAs
      return { ema9: NaN, ema21: NaN, warmupComplete: false };
    }

    this.prevEMA9 = this.currentEMA9;
    this.prevEMA21 = this.currentEMA21;
    this.currentEMA9 = (close - this.currentEMA9) * mult9 + this.currentEMA9;
    this.currentEMA21 = (close - this.currentEMA21) * mult21 + this.currentEMA21;

    return {
      ema9: this.currentEMA9,
      ema21: this.currentEMA21,
      warmupComplete: true
    };
  }

  private detectCrossover(
    prev9: number, prev21: number,
    curr9: number, curr21: number
  ): CrossoverDirection {
    if (isNaN(prev9) || isNaN(prev21) || isNaN(curr9) || isNaN(curr21)) {
      return 'NONE';
    }

    if (prev9 <= prev21 && curr9 > curr21) return 'BULLISH';
    if (prev9 >= prev21 && curr9 < curr21) return 'BEARISH';
    return 'NONE';
  }

  private setOpenTrade(
    strike: number,
    optionType: OptionType,
    optionSymbol: string,
    expiryDate: Date
  ): void {
    this.openTradeStrike = strike;
    this.openTradeOptionType = optionType;
    this.openTradeSymbol = optionSymbol;
    this.openTradeExpiryDate = expiryDate;
  }

  private clearOpenTrade(): void {
    this.openTradeSymbol = '';
    this.openTradeStrike = 0;
    this.openTradeOptionType = 'CE';
    this.openTradeExpiryDate = new Date(0);
  }

  private createExitSignal(
    barCloseTime: Date,
    exitReason: 'SQUARE_OFF_1500' | 'OPPOSITE_CROSSOVER',
    spotPrice: number = 0
  ): Signal {
    return {
      strategyId: this.config.id!,
      runType: this.runType,
      barTime: barCloseTime,
      signalType: this.currentPosition === 'LONG' ? 'SELL' : 'BUY',
      ema9: this.currentEMA9,
      ema21: this.currentEMA21,
      spotPrice,
      selectedStrike: this.openTradeStrike,
      optionType: this.openTradeOptionType,
      optionSymbol: this.openTradeSymbol,
      expiryDate: this.openTradeExpiryDate,
      entryWindowValid: true,
      isReversal: false,
      currentPosition: this.currentPosition!,
      metadata: { exitReason, isExit: true, canTrade: true }
    };
  }

  /**
   * Initialize with historical EMAs (for session recovery)
   */
  initializeFromHistory(ema9: number, ema21: number, position: TradeSide | null): void {
    this.currentEMA9 = ema9;
    this.currentEMA21 = ema21;
    this.prevEMA9 = ema9;
    this.prevEMA21 = ema21;
    this.currentPosition = position;
  }

  getCurrentPosition(): TradeSide | null {
    return this.currentPosition;
  }

  getEMAState(): { ema9: number; ema21: number } {
    return { ema9: this.currentEMA9, ema21: this.currentEMA21 };
  }

  reset(): void {
    this.currentPosition = null;
    this.clearOpenTrade();
    this.lastProcessedBarTime = null;
    this.currentEMA9 = NaN;
    this.currentEMA21 = NaN;
    this.prevEMA9 = NaN;
    this.prevEMA21 = NaN;
  }
}