import type pino from 'pino';

export interface AlertPayload {
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  event: string;
  userId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Structured alerting service for live trading errors, emergency stops, and daily loss thresholds (S6-010).
 * Sends JSON webhook alerts when ALERT_WEBHOOK_URL is configured and always logs via Pino.
 */
export class AlertingService {
  private logger: pino.Logger;
  private webhookUrl: string | undefined;

  constructor(logger: pino.Logger, webhookUrl = process.env['ALERT_WEBHOOK_URL']) {
    this.logger = logger.child({ component: 'AlertingService' });
    this.webhookUrl = webhookUrl;
  }

  async sendAlert(payload: AlertPayload): Promise<void> {
    const logFn =
      payload.severity === 'CRITICAL'
        ? this.logger.error.bind(this.logger)
        : payload.severity === 'WARNING'
          ? this.logger.warn.bind(this.logger)
          : this.logger.info.bind(this.logger);

    logFn({ alert: payload }, `[ALERT:${payload.severity}] ${payload.event}: ${payload.message}`);

    if (!this.webhookUrl) return;

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
}
