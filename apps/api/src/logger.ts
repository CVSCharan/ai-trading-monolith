import pino from 'pino';
import { config } from './config';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.totp',
  '*.totpSecret',
  '*.totpToken',
  '*.accessToken',
  '*.refreshToken',
  '*.apiKey',
  '*.apiSecret',
  '*.masterKey',
  '*.password',
];

export const logger = pino({
  name: 'groww-api',
  level: config.logLevel,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  ...(config.nodeEnv !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});
