// ============================================
// AirSentinel AI - Main API Server
// ============================================

import { Hono, type Context, type Next } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { z } from 'zod';
import { env, isDemoMode } from './config/env';
import { openSkyClient } from './services/opensky';
import { detectAnomalies, detectAnomaliesBatch, getAnomalyStats } from './services/anomaly-detection';
import {
  transcribeATCAudio,
  analyzeImage,
  generateIncidentBriefing,
  processNaturalLanguageQuery,
  generateEmbeddings,
} from './services/ai-inference';
import { hfDatasetsClient } from './services/hf-datasets';
import { loadPersistedAnomalies, loadPersistedIncidents, saveAnomalies, saveIncidents } from './services/persistence';
import type {
  APIResponse,
  Aircraft,
  EnrichedAircraft,
  FlightAnomaly,
  Incident,
  DashboardStats,
  DataSources,
  HistoricalIncident,
  BoundingBox,
  GeoCircle,
} from '../../shared/types';

const APP_NAME = 'AirSentinel AI API';
const APP_VERSION = '1.0.0';
const startedAt = Date.now();
const MAX_PUBLIC_LIMIT = 100;

type ErrorStatus = 400 | 403 | 404 | 413 | 429 | 500 | 503;

function apiError(c: Context, status: ErrorStatus, code: string, message: string, details?: unknown) {
  return c.json({
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  }, status);
}

function parseIntegerParam(
  c: Context,
  name: string,
  defaultValue: number,
  options: { min?: number; max?: number } = {}
): { value: number } | { response: Response } {
  const raw = c.req.query(name);
  const value = raw === undefined ? defaultValue : Number(raw);
  const min = options.min ?? Number.MIN_SAFE_INTEGER;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;

  if (!Number.isInteger(value) || value < min || value > max) {
    return {
      response: apiError(
        c,
        400,
        'INVALID_PARAMS',
        `${name} must be an integer between ${min} and ${max}`
      ),
    };
  }

  return { value };
}

function parseNumberParam(
  c: Context,
  name: string,
  options: { min?: number; max?: number; required?: boolean } = {}
): { value: number } | { response: Response } {
  const raw = c.req.query(name);
  if (raw === undefined || raw === '') {
    if (options.required) {
      return { response: apiError(c, 400, 'INVALID_PARAMS', `${name} is required`) };
    }
    return { value: 0 };
  }

  const value = Number(raw);
  const min = options.min ?? -Infinity;
  const max = options.max ?? Infinity;

  if (!Number.isFinite(value) || value < min || value > max) {
    return {
      response: apiError(c, 400, 'INVALID_PARAMS', `${name} must be a number between ${min} and ${max}`),
    };
  }

  return { value };
}

async function parseJsonBody<T>(c: Context, schema: z.ZodSchema<T>): Promise<
  { data: T } | { response: Response }
> {
  try {
    const body = await c.req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return {
        response: apiError(c, 400, 'INVALID_INPUT', 'Invalid request body', parsed.error.flatten()),
      };
    }

    return { data: parsed.data };
  } catch {
    return { response: apiError(c, 400, 'INVALID_JSON', 'Request body must be valid JSON') };
  }
}

function getClientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit() {
  return async (c: Context, next: Next) => {
    const now = Date.now();
    const routeKey = `${c.req.method}:${new URL(c.req.url).pathname}`;
    const key = `${getClientIp(c)}:${routeKey}`;
    const current = rateLimitStore.get(key);

    if (!current || now >= current.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + env.RATE_LIMIT_WINDOW_MS });
      await next();
      return;
    }

    if (current.count >= env.RATE_LIMIT_MAX) {
      c.header('Retry-After', Math.ceil((current.resetAt - now) / 1000).toString());
      return apiError(c, 429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
    }

    current.count += 1;
    await next();
  };
}

function validateUpload(c: Context, file: File | undefined, label: string): { file: File } | { response: Response } {
  if (!file) {
    return { response: apiError(c, 400, 'MISSING_FILE', `No ${label} file provided`) };
  }

  if (file.size > env.MAX_UPLOAD_BYTES) {
    return {
      response: apiError(
        c,
        413,
        'UPLOAD_TOO_LARGE',
        `${label} file exceeds the configured upload size limit`
      ),
    };
  }

  return { file };
}

const imageUrlSchema = z.object({
  url: z.string().url(),
  type: z.enum(['satellite', 'airport', 'aircraft', 'incident']).default('airport'),
  questions: z.array(z.string().min(1).max(500)).max(10).optional(),
});

const naturalQuerySchema = z.object({
  query: z.string().trim().min(1).max(1000),
  context: z.unknown().optional(),
});

const embeddingsSchema = z.object({
  texts: z.array(z.string().trim().min(1).max(2000)).min(1).max(25),
});

const createIncidentSchema = z.object({
  source: z.enum(['faa', 'ntsb', 'news', 'social', 'user_report', 'asrs']).default('user_report'),
  source_url: z.string().url().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  occurred_at: z.string().datetime().optional(),
  location: z.object({
    airport_icao: z.string().min(3).max(4).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    region: z.string().max(200).optional(),
  }).optional(),
  aircraft_involved: z.array(z.object({
    registration: z.string().max(20).optional(),
    type: z.string().max(100).optional(),
    operator: z.string().max(100).optional(),
    callsign: z.string().max(20).optional(),
  })).max(20).optional(),
  severity: z.enum(['minor', 'moderate', 'serious', 'fatal']).default('moderate'),
  categories: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
});

const readiness = {
  initializationComplete: false,
  coreInitializationFailed: false,
  persistence: 'starting' as 'starting' | 'ready' | 'failed',
  datasets: 'starting' as 'starting' | 'ready' | 'degraded' | 'failed',
  error: null as string | null,
};

// Initialize Hono app
const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: (origin) => origin === env.FRONTEND_ORIGIN ? origin : undefined,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => {
  return c.json({
    name: APP_NAME,
    version: APP_VERSION,
    status: 'operational',
    mode: isDemoMode ? 'demo' : 'production',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      name: APP_NAME,
      version: APP_VERSION,
      environment: env.APP_ENV,
      mode: isDemoMode ? 'demo' : 'production',
      uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/ready', async (c) => {
  await initializationPromise;

  const datasetStatus = hfDatasetsClient.getStatus();
  const readyStatus = {
    name: APP_NAME,
    version: APP_VERSION,
    ready: !readiness.coreInitializationFailed,
    initialized: readiness.initializationComplete,
    timestamp: new Date().toISOString(),
    dependencies: {
      persistence: { status: readiness.persistence },
      huggingface_datasets: {
        status: readiness.datasets,
        aircraft_metadata_loaded: datasetStatus.aircraftMetadata.loaded,
        historical_incidents_loaded: datasetStatus.historicalIncidents.loaded,
        atc_transcripts_available: datasetStatus.atcTranscripts.available,
      },
      opensky: {
        status: env.ENABLE_LIVE_TRACKING ? 'configured' : 'disabled',
        authenticated: Boolean(
          (env.OPENSKY_CLIENT_ID && env.OPENSKY_CLIENT_SECRET) ||
          (env.OPENSKY_USERNAME && env.OPENSKY_PASSWORD)
        ),
      },
      ai: {
        status: isDemoMode ? 'demo' : 'live',
        provider: isDemoMode ? 'mock' : 'huggingface',
      },
    },
    error: readiness.error,
  };

  return c.json({ success: true, data: readyStatus }, readyStatus.ready ? 200 : 503);
});

// ============================================
// Flight Tracking Endpoints
// ============================================

const flights = new Hono();

// Get all tracked flights
flights.get('/', async (c) => {
  try {
    const parsedLimit = parseIntegerParam(c, 'limit', 100, { min: 1, max: MAX_PUBLIC_LIMIT });
    if ('response' in parsedLimit) return parsedLimit.response;
    const limit = parsedLimit.value;
    const aircraft = await openSkyClient.getAllStates();
    const { anomalies: allAnomalies } = await refreshGlobalAnomalies(aircraft);
    
    // Run anomaly detection on all aircraft
    const limited = aircraft.slice(0, limit);
    const limitedIcao24 = new Set(limited.map((ac) => ac.icao24));
    const anomalies = allAnomalies.filter((anomaly) =>
      limitedIcao24.has(anomaly.flight_icao24)
    );
    const enriched = hfDatasetsClient.enrichAircraftBatch(limited);

    const response: APIResponse<{ aircraft: EnrichedAircraft[]; anomalies: FlightAnomaly[] }> = {
      success: true,
      data: {
        aircraft: enriched,
        anomalies,
      },
      meta: {
        total: aircraft.length,
        processing_time_ms: 0,
      },
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Error fetching flights:', error);
    return c.json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to fetch flight data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// Get flights in bounding box
flights.get('/area', async (c) => {
  try {
    const parsedMinLat = parseNumberParam(c, 'min_lat', { min: -90, max: 90, required: true });
    const parsedMaxLat = parseNumberParam(c, 'max_lat', { min: -90, max: 90, required: true });
    const parsedMinLon = parseNumberParam(c, 'min_lon', { min: -180, max: 180, required: true });
    const parsedMaxLon = parseNumberParam(c, 'max_lon', { min: -180, max: 180, required: true });
    if ('response' in parsedMinLat) return parsedMinLat.response;
    if ('response' in parsedMaxLat) return parsedMaxLat.response;
    if ('response' in parsedMinLon) return parsedMinLon.response;
    if ('response' in parsedMaxLon) return parsedMaxLon.response;

    const minLat = parsedMinLat.value;
    const maxLat = parsedMaxLat.value;
    const minLon = parsedMinLon.value;
    const maxLon = parsedMaxLon.value;

    if (maxLat <= minLat || maxLon <= minLon) {
      return apiError(c, 400, 'INVALID_PARAMS', 'Bounding box max values must be greater than min values');
    }
    
    const bbox: BoundingBox = { min_lat: minLat, max_lat: maxLat, min_lon: minLon, max_lon: maxLon };
    const aircraft = await openSkyClient.getStatesByBoundingBox(bbox);
    const anomalies = detectAnomaliesBatch(aircraft);
    const enriched = hfDatasetsClient.enrichAircraftBatch(aircraft);

    return c.json({
      success: true,
      data: { aircraft: enriched, anomalies },
      meta: { total: aircraft.length },
    });
  } catch (error) {
    console.error('Error fetching flights by area:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch flight data' },
    }, 500);
  }
});

// Get flights within radius
flights.get('/radius', async (c) => {
  try {
    const parsedLat = parseNumberParam(c, 'lat', { min: -90, max: 90, required: true });
    const parsedLon = parseNumberParam(c, 'lon', { min: -180, max: 180, required: true });
    const parsedRadius = parseNumberParam(c, 'radius_nm', { min: 1, max: 500 });
    if ('response' in parsedLat) return parsedLat.response;
    if ('response' in parsedLon) return parsedLon.response;
    if ('response' in parsedRadius) return parsedRadius.response;

    const lat = parsedLat.value;
    const lon = parsedLon.value;
    const radiusNm = c.req.query('radius_nm') === undefined ? 50 : parsedRadius.value;
    
    const circle: GeoCircle = { latitude: lat, longitude: lon, radius_nm: radiusNm };
    const aircraft = await openSkyClient.getStatesByRadius(circle);
    const anomalies = detectAnomaliesBatch(aircraft);
    const enriched = hfDatasetsClient.enrichAircraftBatch(aircraft);

    return c.json({
      success: true,
      data: { aircraft: enriched, anomalies },
      meta: { total: aircraft.length },
    });
  } catch (error) {
    console.error('Error fetching flights by radius:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch flight data' },
    }, 500);
  }
});

// Get specific flight by ICAO24
flights.get('/:icao24', async (c) => {
  try {
    const icao24 = c.req.param('icao24');
    const aircraft = await openSkyClient.getStatesByIcao24([icao24]);
    
    if (aircraft.length === 0) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Aircraft ${icao24} not found or not currently transmitting` },
      }, 404);
    }
    
    const anomalies = detectAnomalies(aircraft[0]);
    const enriched = hfDatasetsClient.enrichAircraft(aircraft[0]);

    return c.json({
      success: true,
      data: { aircraft: enriched, anomalies },
    });
  } catch (error) {
    console.error('Error fetching flight:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch flight data' },
    }, 500);
  }
});

// Get flight track/history
flights.get('/:icao24/track', async (c) => {
  try {
    const icao24 = c.req.param('icao24');
    const time = c.req.query('time') ? parseInt(c.req.query('time')!) : undefined;
    
    const track = await openSkyClient.getFlightTrack(icao24, time);
    
    if (!track) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: `No track data available for ${icao24}` },
      }, 404);
    }
    
    return c.json({
      success: true,
      data: track,
    });
  } catch (error) {
    console.error('Error fetching flight track:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch track data' },
    }, 500);
  }
});

app.route('/api/flights', flights);

// ============================================
// Anomaly Endpoints
// ============================================

const anomaliesRouter = new Hono();

// In-memory anomaly store (would be database in production)
const anomalyStore: FlightAnomaly[] = [];

function getAnomalySignature(anomaly: FlightAnomaly): string {
  const lat = anomaly.location.latitude.toFixed(3);
  const lon = anomaly.location.longitude.toFixed(3);
  return `${anomaly.flight_icao24}:${anomaly.type}:${lat}:${lon}`;
}

function syncAnomalyStore(anomalies: FlightAnomaly[]): FlightAnomaly[] {
  const existingBySignature = new Map(
    anomalyStore.map((anomaly) => [getAnomalySignature(anomaly), anomaly])
  );

  const refreshed = anomalies.map((anomaly) => {
    const existing = existingBySignature.get(getAnomalySignature(anomaly));
    return existing
      ? {
          ...anomaly,
          id: existing.id,
          ai_analysis: existing.ai_analysis ?? anomaly.ai_analysis,
        }
      : anomaly;
  });

  anomalyStore.splice(0, anomalyStore.length, ...refreshed);
  void saveAnomalies(anomalyStore);
  return anomalyStore;
}

async function refreshGlobalAnomalies(aircraft?: Aircraft[]): Promise<{
  aircraft: Aircraft[];
  anomalies: FlightAnomaly[];
}> {
  try {
    const liveAircraft = aircraft ?? await openSkyClient.getAllStates();
    const anomalies = syncAnomalyStore(detectAnomaliesBatch(liveAircraft));

    return {
      aircraft: liveAircraft,
      anomalies: [...anomalies],
    };
  } catch (error) {
    console.error('Error refreshing anomaly store:', error);
    return {
      aircraft: [],
      anomalies: [...anomalyStore],
    };
  }
}

// Get recent anomalies
anomaliesRouter.get('/', async (c) => {
  await refreshGlobalAnomalies();

  const severity = c.req.query('severity');
  const type = c.req.query('type');
  const parsedLimit = parseIntegerParam(c, 'limit', 50, { min: 1, max: MAX_PUBLIC_LIMIT });
  if ('response' in parsedLimit) return parsedLimit.response;
  const limit = parsedLimit.value;
  
  let filtered = [...anomalyStore];
  
  if (severity) {
    filtered = filtered.filter(a => a.severity === severity);
  }
  if (type) {
    filtered = filtered.filter(a => a.type === type);
  }
  
  // Sort by time (newest first) and limit
  filtered.sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());
  filtered = filtered.slice(0, limit);
  
  return c.json({
    success: true,
    data: filtered,
    meta: {
      total: anomalyStore.length,
      stats: getAnomalyStats(anomalyStore),
    },
  });
});

// Get anomaly by ID
anomaliesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  let anomaly = anomalyStore.find(a => a.id === id);

  if (!anomaly) {
    await refreshGlobalAnomalies();
    anomaly = anomalyStore.find(a => a.id === id);
  }
  if (!anomaly) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Anomaly ${id} not found` },
    }, 404);
  }
  
  return c.json({ success: true, data: anomaly });
});

// Analyze anomaly with AI
anomaliesRouter.post('/:id/analyze', rateLimit(), async (c) => {
  const id = c.req.param('id');
  let anomaly = anomalyStore.find(a => a.id === id);

  if (!anomaly) {
    await refreshGlobalAnomalies();
    anomaly = anomalyStore.find(a => a.id === id);
  }
  if (!anomaly) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Anomaly ${id} not found` },
    }, 404);
  }
  
  // Generate AI analysis
  const analysis = `Analysis of ${anomaly.type} anomaly for ${anomaly.callsign || anomaly.flight_icao24}: ${anomaly.details.description}. This type of event typically warrants monitoring but may not indicate immediate safety concerns unless accompanied by emergency communications.`;
  
  anomaly.ai_analysis = analysis;
  await saveAnomalies(anomalyStore);
  
  return c.json({ success: true, data: anomaly });
});

app.route('/api/anomalies', anomaliesRouter);

// ============================================
// ATC Audio Processing Endpoints
// ============================================

const atc = new Hono();

// Process ATC audio file
atc.post('/transcribe', rateLimit(), async (c) => {
  try {
    const body = await c.req.parseBody();
    const upload = validateUpload(c, body['audio'] as File | undefined, 'audio');
    if ('response' in upload) return upload.response;
    
    const arrayBuffer = await upload.file.arrayBuffer();
    const result = await transcribeATCAudio(arrayBuffer);
    
    return c.json({
      success: true,
      data: {
        id: `ATC-${Date.now()}`,
        frequency: 'Unknown',
        timestamp: new Date().toISOString(),
        duration_seconds: 0,
        raw_transcript: result.segments.map(s => s.text).join(' '),
        processed_transcript: result,
      },
    });
  } catch (error) {
    console.error('Error processing ATC audio:', error);
    return c.json({
      success: false,
      error: { code: 'PROCESSING_ERROR', message: 'Failed to process audio' },
    }, 500);
  }
});

// Get ATC transcript feed (from archive when live audio unavailable)
atc.get('/live', async (c) => {
  const frequency = c.req.query('frequency') || '118.100';
  const parsedLimit = parseIntegerParam(c, 'limit', 10, { min: 1, max: MAX_PUBLIC_LIMIT });
  if ('response' in parsedLimit) return parsedLimit.response;
  const limit = parsedLimit.value;

  try {
    await initializationPromise;

    const result = await hfDatasetsClient.getATCTranscripts(0, limit);
    const transmissions = result.entries.map((entry) => ({
      speaker: 'unknown' as const,
      text: entry.text,
    }));
    const source = result.entries.length > 0 && result.entries[0].source.startsWith('mock')
      ? 'demo'
      : result.total > 0
        ? 'archive'
        : 'unavailable';

    return c.json({
      success: true,
      data: {
        frequency,
        airport: 'ARCHIVE',
        stream_url: null,
        is_live: false,
        source,
        total_available: result.total,
        recent_transmissions: transmissions,
      },
    });
  } catch (error) {
    console.error('Error fetching ATC transcripts:', error);
    return c.json({
      success: true,
      data: {
        frequency,
        airport: 'UNAVAILABLE',
        stream_url: null,
        is_live: false,
        source: 'unavailable',
        total_available: 0,
        recent_transmissions: [],
      },
    });
  }
});

app.route('/api/atc', atc);

// ============================================
// Image Analysis Endpoints
// ============================================

const images = new Hono();

// Analyze uploaded image
images.post('/analyze', rateLimit(), async (c) => {
  try {
    const body = await c.req.parseBody();
    const upload = validateUpload(c, body['image'] as File | undefined, 'image');
    if ('response' in upload) return upload.response;

    const parsedAnalysisType = z
      .enum(['satellite', 'airport', 'aircraft', 'incident'])
      .safeParse(body['type'] || 'airport');
    if (!parsedAnalysisType.success) {
      return apiError(c, 400, 'INVALID_INPUT', 'type must be satellite, airport, aircraft, or incident');
    }
    const analysisType = parsedAnalysisType.data;
    const questionsRaw = body['questions'] as string;
    let questions: string[] | undefined;

    if (questionsRaw) {
      let parsedRawQuestions: unknown;
      try {
        parsedRawQuestions = JSON.parse(questionsRaw);
      } catch {
        return apiError(c, 400, 'INVALID_INPUT', 'questions must be valid JSON');
      }

      const parsedQuestions = z
        .array(z.string().min(1).max(500))
        .max(10)
        .safeParse(parsedRawQuestions);

      if (!parsedQuestions.success) {
        return apiError(c, 400, 'INVALID_INPUT', 'questions must be an array of strings');
      }

      questions = parsedQuestions.data;
    }
    
    const result = await analyzeImage(
      upload.file,
      analysisType,
      questions
    );
    
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Error analyzing image:', error);
    return c.json({
      success: false,
      error: { code: 'PROCESSING_ERROR', message: 'Failed to analyze image' },
    }, 500);
  }
});

// Analyze image from URL
images.post('/analyze-url', rateLimit(), async (c) => {
  try {
    const parsed = await parseJsonBody(c, imageUrlSchema);
    if ('response' in parsed) return parsed.response;
    const { url, type, questions } = parsed.data;
    
    const result = await analyzeImage(url, type ?? 'airport', questions);
    
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Error analyzing image:', error);
    return c.json({
      success: false,
      error: { code: 'PROCESSING_ERROR', message: 'Failed to analyze image' },
    }, 500);
  }
});

app.route('/api/images', images);

// ============================================
// Incident & Briefing Endpoints
// ============================================

const incidentsRouter = new Hono();

// User-submitted incident store (ASRS incidents come from HF Datasets)
const userIncidentStore: Incident[] = [];

function toUTCDate(year: number, month = 1, day = 1): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeASRSDate(date: string | null): string {
  const fallback = new Date().toISOString();
  const raw = date?.trim();

  if (!raw) {
    return fallback;
  }

  const compactDay = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactDay) {
    return toUTCDate(
      Number(compactDay[1]),
      Number(compactDay[2]),
      Number(compactDay[3])
    ) ?? fallback;
  }

  const compactMonth = raw.match(/^(\d{4})(\d{2})$/);
  if (compactMonth) {
    return toUTCDate(Number(compactMonth[1]), Number(compactMonth[2])) ?? fallback;
  }

  const isoMonth = raw.match(/^(\d{4})-(\d{2})$/);
  if (isoMonth) {
    return toUTCDate(Number(isoMonth[1]), Number(isoMonth[2])) ?? fallback;
  }

  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) {
    return toUTCDate(Number(yearOnly[1])) ?? fallback;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

// Adapter: HistoricalIncident (ASRS) to Incident
function historicalIncidentToIncident(h: HistoricalIncident): Incident {
  const severityMap: Record<string, Incident['severity']> = {
    'Human Factors': 'moderate',
    'Ambiguous': 'moderate',
    'Conflict': 'serious',
    'Non-Adherence': 'moderate',
    'Other': 'minor',
  };
  const incidentDate = normalizeASRSDate(h.date);

  return {
    id: h.id,
    source: 'asrs',
    title: h.primaryProblem
      ? `${h.primaryProblem} - ${h.aircraftMakeModel || 'Unknown Aircraft'}`
      : `ASRS Report ${h.acnNumber}`,
    description: h.narrative || h.synopsis || 'No narrative available.',
    occurred_at: incidentDate,
    reported_at: incidentDate,
    location: h.localeReference || h.stateReference
      ? { region: [h.localeReference, h.stateReference].filter(Boolean).join(', ') }
      : undefined,
    aircraft_involved: h.aircraftMakeModel
      ? [{ type: h.aircraftMakeModel, operator: h.aircraftOperator || undefined }]
      : undefined,
    severity: severityMap[h.primaryProblem || ''] || 'moderate',
    categories: [h.anomaly, h.primaryProblem, h.flightPhase].filter(Boolean) as string[],
    status: 'final' as Incident['status'],
    raw_data: h as unknown,
  };
}

// Get all incidents (ASRS + user-submitted)
incidentsRouter.get('/', async (c) => {
  const severity = c.req.query('severity');
  const source = c.req.query('source');
  const parsedLimit = parseIntegerParam(c, 'limit', 50, { min: 1, max: MAX_PUBLIC_LIMIT });
  const parsedOffset = parseIntegerParam(c, 'offset', 0, { min: 0 });
  if ('response' in parsedLimit) return parsedLimit.response;
  if ('response' in parsedOffset) return parsedOffset.response;
  const limit = parsedLimit.value;
  const offset = parsedOffset.value;

  try {
    await initializationPromise;

    const shouldFetchASRS = source !== 'user_report';
    const primaryProblem = c.req.query('problem') || undefined;
    const flightPhase = c.req.query('phase') || undefined;

    const asrsIncidents = shouldFetchASRS
      ? hfDatasetsClient
          .getCachedIncidents({ primaryProblem, flightPhase })
          .map(historicalIncidentToIncident)
      : [];

    // Merge with user-submitted incidents
    const allIncidents = [...asrsIncidents, ...userIncidentStore];

    let filtered = allIncidents;
    if (severity) filtered = filtered.filter(i => i.severity === severity);
    if (source) filtered = filtered.filter(i => i.source === source);

    filtered.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    const paginated = filtered.slice(offset, offset + limit);

    return c.json({
      success: true,
      data: paginated,
      meta: {
        total: filtered.length,
        offset,
        hasMore: offset + limit < filtered.length,
      },
    });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    // Fallback to user-submitted only
    return c.json({
      success: true,
      data: userIncidentStore.slice(0, limit),
      meta: { total: userIncidentStore.length, offset, hasMore: false },
    });
  }
});

// Get incident by ID
incidentsRouter.get('/:id', async (c) => {
  await initializationPromise;

  const id = c.req.param('id');

  // Check user-submitted first
  const userIncident = userIncidentStore.find(i => i.id === id);
  if (userIncident) {
    return c.json({ success: true, data: userIncident });
  }

  // Try ASRS by ID
  const historical = await hfDatasetsClient.getHistoricalIncident(id);
  if (historical) {
    return c.json({ success: true, data: historicalIncidentToIncident(historical) });
  }

  return c.json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Incident ${id} not found` },
  }, 404);
});

// Generate incident briefing
incidentsRouter.post('/:id/briefing', rateLimit(), async (c) => {
  try {
    const id = c.req.param('id');
    await initializationPromise;

    // Find incident from either source
    let incident: Incident | undefined = userIncidentStore.find(i => i.id === id);
    if (!incident) {
      const historical = await hfDatasetsClient.getHistoricalIncident(id);
      if (historical) {
        incident = historicalIncidentToIncident(historical);
      }
    }

    if (!incident) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Incident ${id} not found` },
      }, 404);
    }

    const briefing = await generateIncidentBriefing(incident);

    return c.json({ success: true, data: briefing });
  } catch (error) {
    console.error('Error generating briefing:', error);
    return c.json({
      success: false,
      error: { code: 'PROCESSING_ERROR', message: 'Failed to generate briefing' },
    }, 500);
  }
});

// Create new incident (for manual reporting)
incidentsRouter.post('/', rateLimit(), async (c) => {
  try {
    if (!env.ENABLE_PUBLIC_WRITES) {
      return apiError(c, 403, 'PUBLIC_WRITES_DISABLED', 'Public incident submissions are disabled');
    }

    const parsed = await parseJsonBody(c, createIncidentSchema);
    if ('response' in parsed) return parsed.response;
    const body = parsed.data;
    
    const newIncident: Incident = {
      id: `USR-${Date.now()}`,
      source: body.source || 'user_report',
      source_url: body.source_url,
      title: body.title,
      description: body.description,
      occurred_at: body.occurred_at || new Date().toISOString(),
      reported_at: new Date().toISOString(),
      location: body.location,
      aircraft_involved: body.aircraft_involved,
      severity: body.severity || 'moderate',
      categories: body.categories || [],
      status: 'reported',
    };
    
    userIncidentStore.push(newIncident);
    await saveIncidents(userIncidentStore);
    
    return c.json({ success: true, data: newIncident }, 201);
  } catch (error) {
    console.error('Error creating incident:', error);
    return c.json({
      success: false,
      error: { code: 'CREATE_ERROR', message: 'Failed to create incident' },
    }, 500);
  }
});

app.route('/api/incidents', incidentsRouter);

// ============================================
// Natural Language Query Endpoint
// ============================================

app.post('/api/query', rateLimit(), async (c) => {
  try {
    const parsedBody = await parseJsonBody(c, naturalQuerySchema);
    if ('response' in parsedBody) return parsedBody.response;
    const { query } = parsedBody.data;
    
    const parsed = await processNaturalLanguageQuery(query);
    
    // Build response based on intent
    let responseText = '';
    let results: any[] = [];
    
    switch (parsed.intent) {
      case 'flight_status':
        if (parsed.entities.flight) {
          responseText = `Looking up status for flight ${parsed.entities.flight}...`;
        } else {
          responseText = 'Please specify a flight number to look up.';
        }
        break;
        
      case 'incident_search': {
        await initializationPromise;
        const incidentResult = await hfDatasetsClient.browseIncidents({ limit: 5 });
        results = incidentResult.incidents.map(historicalIncidentToIncident);
        responseText = `Found ${incidentResult.total} incidents in ASRS database.`;
        break;
      }
        
      case 'anomaly_report': {
        const { anomalies: liveAnomalies } = await refreshGlobalAnomalies();
        results = liveAnomalies.slice(0, 10);
        responseText = `${liveAnomalies.length} anomalies detected recently.`;
        break;
      }
        
      case 'airport_activity':
        if (parsed.entities.airport) {
          responseText = `Fetching activity for ${parsed.entities.airport}...`;
        } else {
          responseText = 'Please specify an airport code.';
        }
        break;
        
      default:
        responseText = `I understood your query as: "${query}". Intent: ${parsed.intent}`;
    }
    
    return c.json({
      success: true,
      data: {
        query_id: `Q-${Date.now()}`,
        original_query: query,
        interpreted_intent: parsed.intent,
        entities: parsed.entities,
        response: responseText,
        results,
        suggested_followups: [
          'Show me more details',
          'Filter by severity',
          'Export results',
        ],
      },
    });
  } catch (error) {
    console.error('Error processing query:', error);
    return c.json({
      success: false,
      error: { code: 'QUERY_ERROR', message: 'Failed to process query' },
    }, 500);
  }
});

// ============================================
// Dashboard Stats Endpoint
// ============================================

app.get('/api/dashboard/stats', async (c) => {
  try {
    await initializationPromise;

    // Get current counts
    const datasetStatus = hfDatasetsClient.getStatus();
    const { aircraft, anomalies } = await refreshGlobalAnomalies();
    
    const flightsLive = aircraft.length > 0;
    const incidentsLive = datasetStatus.historicalIncidents.loaded;
    const atcLive = datasetStatus.atcTranscripts.available;
    
    const stats: DashboardStats = {
      flights_tracked: aircraft.length,
      active_anomalies: anomalies.filter(
        a => new Date(a.detected_at).getTime() > Date.now() - 3600000
      ).length,
      incidents_today: userIncidentStore.filter(
        i => new Date(i.occurred_at).toDateString() === new Date().toDateString()
      ).length,
      atc_transcripts_available: datasetStatus.atcTranscripts.totalEntries,
      dataset_aircraft_loaded: datasetStatus.aircraftMetadata.count,
      dataset_incidents_loaded: datasetStatus.historicalIncidents.seedCount,
      last_updated: new Date().toISOString(),
      data_sources: {
        flights: flightsLive ? 'live' : 'unavailable',
        anomalies: flightsLive ? 'live' : 'unavailable',
        incidents: incidentsLive ? 'asrs' : 'demo',
        atc: atcLive ? 'archive' : 'demo',
        ai: isDemoMode ? 'demo' : 'live',
      },
    };

    return c.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({
      success: false,
      error: { code: 'STATS_ERROR', message: 'Failed to fetch dashboard stats' },
    }, 500);
  }
});

// ============================================
// Embeddings Endpoint (for similarity search)
// ============================================

app.post('/api/embeddings', rateLimit(), async (c) => {
  try {
    const parsed = await parseJsonBody(c, embeddingsSchema);
    if ('response' in parsed) return parsed.response;
    const { texts } = parsed.data;
    
    const embeddings = await generateEmbeddings(texts);
    
    return c.json({
      success: true,
      data: { embeddings, dimensions: embeddings[0]?.length || 0 },
    });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return c.json({
      success: false,
      error: { code: 'EMBEDDING_ERROR', message: 'Failed to generate embeddings' },
    }, 500);
  }
});

// ============================================
// HF Datasets Endpoints
// ============================================

const datasets = new Hono();

// Dataset service status
datasets.get('/status', (c) => {
  const status = hfDatasetsClient.getStatus();
  return c.json({ success: true, data: status });
});

// Aircraft metadata lookup by ICAO24
datasets.get('/aircraft/:icao24', (c) => {
  const icao24 = c.req.param('icao24');
  const metadata = hfDatasetsClient.lookupAircraft(icao24);

  if (!metadata) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: `No metadata for ${icao24}` },
    }, 404);
  }

  return c.json({ success: true, data: metadata });
});

// Search aircraft metadata
datasets.get('/aircraft', (c) => {
  const registration = c.req.query('registration');
  const typecode = c.req.query('typecode');
  const manufacturer = c.req.query('manufacturer');
  const parsedLimit = parseIntegerParam(c, 'limit', 20, { min: 1, max: MAX_PUBLIC_LIMIT });
  if ('response' in parsedLimit) return parsedLimit.response;
  const limit = parsedLimit.value;

  const results = hfDatasetsClient.searchAircraft({
    registration: registration || undefined,
    typecode: typecode || undefined,
    manufacturer: manufacturer || undefined,
    limit,
  });

  return c.json({
    success: true,
    data: results,
    meta: { total: results.length },
  });
});

// Search historical incidents
datasets.get('/incidents/search', async (c) => {
  try {
    const query = c.req.query('q') || '';
    const parsedOffset = parseIntegerParam(c, 'offset', 0, { min: 0 });
    const parsedLimit = parseIntegerParam(c, 'limit', 20, { min: 1, max: MAX_PUBLIC_LIMIT });
    if ('response' in parsedOffset) return parsedOffset.response;
    if ('response' in parsedLimit) return parsedLimit.response;
    const offset = parsedOffset.value;
    const limit = parsedLimit.value;

    const results = await hfDatasetsClient.searchIncidents(query, offset, limit);
    return c.json({ success: true, data: results });
  } catch (error) {
    console.error('Error searching historical incidents:', error);
    return c.json({
      success: false,
      error: { code: 'SEARCH_ERROR', message: 'Failed to search historical incidents' },
    }, 500);
  }
});

// Get historical incident by ID
datasets.get('/incidents/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const incident = await hfDatasetsClient.getHistoricalIncident(id);

    if (!incident) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Historical incident ${id} not found` },
      }, 404);
    }

    return c.json({ success: true, data: incident });
  } catch (error) {
    console.error('Error fetching historical incident:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch historical incident' },
    }, 500);
  }
});

// Browse historical incidents (paginated)
datasets.get('/incidents', async (c) => {
  try {
    const parsedOffset = parseIntegerParam(c, 'offset', 0, { min: 0 });
    const parsedLimit = parseIntegerParam(c, 'limit', 20, { min: 1, max: MAX_PUBLIC_LIMIT });
    if ('response' in parsedOffset) return parsedOffset.response;
    if ('response' in parsedLimit) return parsedLimit.response;
    const offset = parsedOffset.value;
    const limit = parsedLimit.value;
    const primaryProblem = c.req.query('primary_problem');
    const flightPhase = c.req.query('flight_phase');

    const results = await hfDatasetsClient.browseIncidents({
      offset,
      limit,
      primaryProblem: primaryProblem || undefined,
      flightPhase: flightPhase || undefined,
    });

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error('Error browsing historical incidents:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch historical incidents' },
    }, 500);
  }
});

// Get ATC transcript entries
datasets.get('/atc', async (c) => {
  try {
    const parsedOffset = parseIntegerParam(c, 'offset', 0, { min: 0 });
    const parsedLimit = parseIntegerParam(c, 'limit', 20, { min: 1, max: MAX_PUBLIC_LIMIT });
    if ('response' in parsedOffset) return parsedOffset.response;
    if ('response' in parsedLimit) return parsedLimit.response;
    const offset = parsedOffset.value;
    const limit = parsedLimit.value;

    const results = await hfDatasetsClient.getATCTranscripts(offset, limit);
    return c.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching ATC transcripts:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch ATC transcripts' },
    }, 500);
  }
});

// Search ATC transcripts
datasets.get('/atc/search', async (c) => {
  try {
    const query = c.req.query('q') || '';
    const parsedOffset = parseIntegerParam(c, 'offset', 0, { min: 0 });
    const parsedLimit = parseIntegerParam(c, 'limit', 20, { min: 1, max: MAX_PUBLIC_LIMIT });
    if ('response' in parsedOffset) return parsedOffset.response;
    if ('response' in parsedLimit) return parsedLimit.response;
    const offset = parsedOffset.value;
    const limit = parsedLimit.value;

    const results = await hfDatasetsClient.searchATCTranscripts(query, offset, limit);
    return c.json({ success: true, data: results });
  } catch (error) {
    console.error('Error searching ATC transcripts:', error);
    return c.json({
      success: false,
      error: { code: 'SEARCH_ERROR', message: 'Failed to search ATC transcripts' },
    }, 500);
  }
});

app.route('/api/datasets', datasets);

// ============================================
// Initialize HF Datasets Service
// ============================================

const initializationPromise = (async () => {
  try {
    const [persistedIncidents, persistedAnomalies] = await Promise.all([
      loadPersistedIncidents(userIncidentStore),
      loadPersistedAnomalies(),
    ]);

    userIncidentStore.splice(0, userIncidentStore.length, ...persistedIncidents);
    anomalyStore.splice(0, anomalyStore.length, ...persistedAnomalies);
    readiness.persistence = 'ready';
    console.log('Persistent stores initialized');
  } catch (error) {
    readiness.persistence = 'failed';
    readiness.coreInitializationFailed = true;
    readiness.error = error instanceof Error ? error.message : String(error);
    console.error('Persistent store initialization error:', error);
  }

  try {
    await hfDatasetsClient.initialize();
    const status = hfDatasetsClient.getStatus();
    readiness.datasets =
      status.historicalIncidents.loaded || status.aircraftMetadata.loaded || status.atcTranscripts.available
        ? 'ready'
        : 'degraded';
    console.log('HF Datasets service initialized');
  } catch (error) {
    readiness.datasets = 'failed';
    readiness.error = readiness.error
      ? `${readiness.error}; ${error instanceof Error ? error.message : String(error)}`
      : error instanceof Error ? error.message : String(error);
    console.error('HF Datasets initialization error:', error);
  } finally {
    readiness.initializationComplete = true;
  }
})();

// ============================================
// Start Server
// ============================================

const port = parseInt(env.PORT);

// ============================================
// Capabilities Endpoint
// ============================================

app.get('/api/capabilities', async (c) => {
  await initializationPromise;

  const datasetStatus = hfDatasetsClient.getStatus();
  const { aircraft } = await refreshGlobalAnomalies();
  const flightsLive = aircraft.length > 0;

  return c.json({
    success: true,
    data: {
      flights: { live: flightsLive, source: flightsLive ? 'opensky' : 'unavailable' },
      anomalies: { live: flightsLive, source: flightsLive ? 'detection-engine' : 'unavailable' },
      incidents: { live: datasetStatus.historicalIncidents.loaded, source: datasetStatus.historicalIncidents.loaded ? 'asrs' : 'demo' },
      atc: { live: datasetStatus.atcTranscripts.available, source: datasetStatus.atcTranscripts.available ? 'archive' : 'demo' },
      ai_inference: { live: !isDemoMode, source: isDemoMode ? 'mock' : 'huggingface' },
      image_analysis: { live: !isDemoMode, source: isDemoMode ? 'mock' : 'huggingface' },
      natural_language_query: { live: !isDemoMode, source: isDemoMode ? 'mock' : 'huggingface' },
    },
  });
});

console.log(`
AirSentinel AI API
Multimodal Aviation Intelligence Platform

Server starting on port ${port}
Environment: ${env.APP_ENV}
Mode: ${isDemoMode ? 'DEMO (AI features mocked)' : 'PRODUCTION'}
Frontend origin: ${env.FRONTEND_ORIGIN}
Public writes: ${env.ENABLE_PUBLIC_WRITES ? 'enabled' : 'disabled'}
`);

export default {
  port,
  fetch: app.fetch,
};


