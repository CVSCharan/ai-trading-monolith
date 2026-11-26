import type pino from 'pino';

export interface AlertPayload {
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  event: string;
  userId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Structured alerting service for live trading errors, emergency stops, daily loss thresholds,
 * and trade entry/exit notifications (S6-010, S15-003).
 * Supports JSON webhook (ALERT_WEBHOOK_URL) and Telegram Bot API (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID).
 */
export class AlertingService {
  private logger: pino.Logger;
  private webhookUrl: string | undefined;
  private telegramToken: string | undefined;
  private telegramChatId: string | undefined;

  constructor(
    logger: pino.Logger,
    webhookUrl = process.env['ALERT_WEBHOOK_URL'],
    telegramToken = process.env['TELEGRAM_BOT_TOKEN'],
    telegramChatId = process.env['TELEGRAM_CHAT_ID'],
  ) {
    this.logger = logger.child({ component: 'AlertingService' });
    this.webhookUrl = webhookUrl;
    this.telegramToken = telegramToken;
    this.telegramChatId = telegramChatId;
  }

  async sendTradeAlert(opts: {
    action: 'ENTRY' | 'EXIT' | 'SQUARE_OFF';
    symbol: string;
    side: string;
    price: number;
    quantity: number;
    pnl?: number;
  }): Promise<void> {
    const pnlText = opts.pnl !== undefined ? ` · P&L: ₹${opts.pnl.toFixed(2)}` : '';
    await this.sendAlert({
      severity: 'INFO',
      event: `TRADE_${opts.action}`,
      message: `${opts.action}: ${opts.side} ${opts.quantity} ${opts.symbol} @ ₹${opts.price.toFixed(2)}${pnlText}`,
      metadata: opts,
    });
  }

  async sendAlert(payload: AlertPayload): Promise<void> {
    const logFn =
      payload.severity === 'CRITICAL'
        ? this.logger.error.bind(this.logger)
        : payload.severity === 'WARNING'
          ? this.logger.warn.bind(this.logger)
          : this.logger.info.bind(this.logger);

    logFn({ alert: payload }, `[ALERT:${payload.severity}] ${payload.event}: ${payload.message}`);

    if (this.webhookUrl) {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        this.logger.error({ err }, 'Failed to deliver alert webhook');
      }
    }

    if (this.telegramToken && this.telegramChatId) {
      try {
        const text = `[${payload.severity}] ${payload.event}\n${payload.message}`;
        await fetch(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.telegramChatId,
            text,
          }),
        });
      } catch (err) {
        this.logger.error({ err }, 'Failed to deliver Telegram alert');
      }
    }
  }
}
