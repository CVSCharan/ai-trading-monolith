import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/trading'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  BETTER_AUTH_SECRET: z.string().min(32).default('dev-secret-change-me-in-prod-must-be-32-chars-minimum'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  ENCRYPTION_MASTER_KEY: z.string().optional(),

  // Broker Routing
  ACTIVE_DATA_BROKER: z.enum(['groww', 'upstox']).default('groww'),
  ACTIVE_EXECUTION_BROKER: z.enum(['groww', 'upstox']).default('groww'),

  // Upstox (Analytics Token = 1yr read-only; Access Token + Static IP = v3 Trading)
  UPSTOX_ANALYTICS_TOKEN: z.string().optional(),
  UPSTOX_ACCESS_TOKEN: z.string().optional(),
  UPSTOX_API_KEY: z.string().optional(),
  UPSTOX_API_SECRET: z.string().optional(),
  UPSTOX_REDIRECT_URI: z.string().optional(),
  UPSTOX_ALGO_NAME: z.string().optional(),
});

const env = EnvSchema.parse(process.env);

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  databaseUrl: env.DATABASE_URL,
  frontendUrl: env.FRONTEND_URL,
  betterAuthSecret: env.BETTER_AUTH_SECRET,
  betterAuthUrl: env.BETTER_AUTH_URL,
  encryptionMasterKey: env.ENCRYPTION_MASTER_KEY,
  activeDataBroker: env.ACTIVE_DATA_BROKER,
  activeExecutionBroker: env.ACTIVE_EXECUTION_BROKER,
  upstox: {
    analyticsToken: env.UPSTOX_ANALYTICS_TOKEN,
    accessToken: env.UPSTOX_ACCESS_TOKEN,
    apiKey: env.UPSTOX_API_KEY,
    apiSecret: env.UPSTOX_API_SECRET,
    redirectUri: env.UPSTOX_REDIRECT_URI,
    algoName: env.UPSTOX_ALGO_NAME,
  },
};
