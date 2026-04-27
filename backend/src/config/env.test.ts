import { describe, expect, it } from 'bun:test';
import { loadEnvFrom } from './env';

describe('environment configuration', () => {
  it('requires FRONTEND_ORIGIN in production', () => {
    expect(() => loadEnvFrom({
      NODE_ENV: 'production',
      APP_ENV: 'production',
    })).toThrow('FRONTEND_ORIGIN is required in production');
  });

  it('uses the local frontend origin outside production', () => {
    const env = loadEnvFrom({
      NODE_ENV: 'development',
    });

    expect(env.FRONTEND_ORIGIN).toBe('http://localhost:5173');
    expect(env.ENABLE_PUBLIC_WRITES).toBe(false);
  });
});
