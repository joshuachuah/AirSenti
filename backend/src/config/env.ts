// ============================================
// AirSentinel AI - Environment Configuration
// ============================================

import { z } from 'zod';

const booleanString = z.string().transform((value) => value === 'true');

const positiveNumberString = z
  .string()
  .transform(Number)
  .refine((value) => Number.isFinite(value) && value > 0, {
    message: 'Must be a positive number',
  });

const nonNegativeNumberString = z
  .string()
  .transform(Number)
  .refine((value) => Number.isFinite(value) && value >= 0, {
    message: 'Must be a non-negative number',
  });

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_ORIGIN: z.string().url().optional(),

  // Database
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/airsentinel'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // External APIs
  OPENSKY_USERNAME: z.string().optional(),
  OPENSKY_PASSWORD: z.string().optional(),
  OPENSKY_CLIENT_ID: z.string().optional(),
  OPENSKY_CLIENT_SECRET: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
  NOAA_API_KEY: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),

  // Feature Flags
  ENABLE_LIVE_TRACKING: booleanString.default('true'),
  ENABLE_ATC_PROCESSING: booleanString.default('true'),
  ENABLE_IMAGE_ANALYSIS: booleanString.default('true'),
  ENABLE_PUBLIC_WRITES: booleanString.default('false'),

  // Rate Limits
  OPENSKY_RATE_LIMIT_MS: positiveNumberString.default('10000'),
  HF_RATE_LIMIT_MS: positiveNumberString.default('1000'),
  HF_DATASETS_RATE_LIMIT_MS: positiveNumberString.default('500'),
  RATE_LIMIT_WINDOW_MS: positiveNumberString.default('60000'),
  RATE_LIMIT_MAX: positiveNumberString.default('60'),
  MAX_UPLOAD_BYTES: positiveNumberString.default('10485760'),

  // HF Datasets
  ENABLE_HF_DATASETS: booleanString.default('true'),
  AIRCRAFT_DB_REFRESH_HOURS: positiveNumberString.default('24'),
  HF_INCIDENT_SEED_COUNT: nonNegativeNumberString.default('200'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnvFrom(source: NodeJS.ProcessEnv = process.env): Env {
  const normalizedSource = {
    ...source,
    APP_ENV: source.APP_ENV || source.NODE_ENV || 'development',
  };
  const isProduction =
    normalizedSource.APP_ENV === 'production' || normalizedSource.NODE_ENV === 'production';
  const env = envSchema.safeParse(normalizedSource);

  if (!env.success) {
    console.error('Invalid environment variables:');
    console.error(env.error.format());

    if (isProduction) {
      throw new Error('Invalid production environment variables');
    }

    return {
      ...envSchema.parse({}),
      FRONTEND_ORIGIN: 'http://localhost:5173',
    };
  }

  if (isProduction && !source.FRONTEND_ORIGIN) {
    throw new Error('FRONTEND_ORIGIN is required in production');
  }

  return {
    ...env.data,
    FRONTEND_ORIGIN: env.data.FRONTEND_ORIGIN || 'http://localhost:5173',
  };
}

export const env = loadEnvFrom();

// Demo mode detection
export const isDemoMode = !env.HUGGINGFACE_API_KEY;
export const isDatasetsEnabled = env.ENABLE_HF_DATASETS;

if (isDemoMode) {
  console.log('Running in DEMO MODE - AI features will use mock responses');
  console.log('   Set HUGGINGFACE_API_KEY to enable real AI inference');
}
