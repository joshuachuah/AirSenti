const configuredApiBase = import.meta.env.VITE_API_BASE?.trim().replace(/\/$/, '');

export const FRONTEND_CONFIG = {
  apiBase: configuredApiBase || '/api',
  publicWritesEnabled: import.meta.env.VITE_ENABLE_PUBLIC_WRITES === 'true',
};
