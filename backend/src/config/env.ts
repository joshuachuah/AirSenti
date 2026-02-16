// ============================================
// AirSentinel AI - Environment Configuration
// ============================================

import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/airsentinel'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // External APIs
  OPENSKY_USERNAME: z.string().optional(),
  OPENSKY_PASSWORD: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
  NOAA_API_KEY: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),
  
  // Feature Flags
  ENABLE_LIVE_TRACKING: z.string().transform(v => v === 'true').default('true'),
  ENABLE_ATC_PROCESSING: z.string().transform(v => v === 'true').default('true'),
  ENABLE_IMAGE_ANALYSIS: z.string().transform(v => v === 'true').default('true'),
  
  // Rate Limits
  OPENSKY_RATE_LIMIT_MS: z.string().transform(Number).default('10000'),
  HF_RATE_LIMIT_MS: z.string().transform(Number).default('1000'),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const env = envSchema.safeParse(process.env);
  
  if (!env.success) {
    console.error('❌ Invalid environment variables:');
    console.error(env.error.format());
    // Return defaults for demo mode
    return envSchema.parse({});
  }
  
  return env.data;
}

export const env = loadEnv();

// Demo mode detection
export const isDemoMode = !env.HUGGINGFACE_API_KEY;

if (isDemoMode) {
  console.log('⚠️  Running in DEMO MODE - AI features will use mock responses');
  console.log('   Set HUGGINGFACE_API_KEY to enable real AI inference');
}
