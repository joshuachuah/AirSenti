// ============================================
// AirSentinel AI - Main API Server
// ============================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
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
import type {
  APIResponse,
  Aircraft,
  EnrichedAircraft,
  FlightAnomaly,
  Incident,
  DashboardStats,
  BoundingBox,
  GeoCircle,
} from '../../shared/types';

// Initialize Hono app
const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', '*'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'AirSentinel AI API',
    version: '1.0.0',
    status: 'operational',
    mode: isDemoMode ? 'demo' : 'production',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Flight Tracking Endpoints
// ============================================

const flights = new Hono();

// Get all tracked flights
flights.get('/', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '100');
    const aircraft = await openSkyClient.getAllStates();
    
    // Run anomaly detection on all aircraft
    const limited = aircraft.slice(0, limit);
    const anomalies = detectAnomaliesBatch(limited);
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
    const minLat = parseFloat(c.req.query('min_lat') || '0');
    const maxLat = parseFloat(c.req.query('max_lat') || '0');
    const minLon = parseFloat(c.req.query('min_lon') || '0');
    const maxLon = parseFloat(c.req.query('max_lon') || '0');
    
    if (!minLat || !maxLat || !minLon || !maxLon) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Missing required bounding box parameters',
        },
      }, 400);
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
    const lat = parseFloat(c.req.query('lat') || '0');
    const lon = parseFloat(c.req.query('lon') || '0');
    const radiusNm = parseFloat(c.req.query('radius_nm') || '50');
    
    if (!lat || !lon) {
      return c.json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Missing lat/lon parameters' },
      }, 400);
    }
    
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

// Get recent anomalies
anomaliesRouter.get('/', (c) => {
  const severity = c.req.query('severity');
  const type = c.req.query('type');
  const limit = parseInt(c.req.query('limit') || '50');
  
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
anomaliesRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const anomaly = anomalyStore.find(a => a.id === id);
  
  if (!anomaly) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Anomaly ${id} not found` },
    }, 404);
  }
  
  return c.json({ success: true, data: anomaly });
});

// Analyze anomaly with AI
anomaliesRouter.post('/:id/analyze', async (c) => {
  const id = c.req.param('id');
  const anomaly = anomalyStore.find(a => a.id === id);
  
  if (!anomaly) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Anomaly ${id} not found` },
    }, 404);
  }
  
  // Generate AI analysis
  const analysis = `Analysis of ${anomaly.type} anomaly for ${anomaly.callsign || anomaly.flight_icao24}: ${anomaly.details.description}. This type of event typically warrants monitoring but may not indicate immediate safety concerns unless accompanied by emergency communications.`;
  
  anomaly.ai_analysis = analysis;
  
  return c.json({ success: true, data: anomaly });
});

app.route('/api/anomalies', anomaliesRouter);

// ============================================
// ATC Audio Processing Endpoints
// ============================================

const atc = new Hono();

// Process ATC audio file
atc.post('/transcribe', async (c) => {
  try {
    const body = await c.req.parseBody();
    const audioFile = body['audio'] as File;
    
    if (!audioFile) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FILE', message: 'No audio file provided' },
      }, 400);
    }
    
    const arrayBuffer = await audioFile.arrayBuffer();
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

// Get mock live ATC feed (for demo)
atc.get('/live', (c) => {
  const frequency = c.req.query('frequency') || '118.100';
  
  // Return mock live data
  return c.json({
    success: true,
    data: {
      frequency,
      airport: 'KLAX',
      stream_url: null,
      recent_transmissions: [
        {
          timestamp: new Date(Date.now() - 30000).toISOString(),
          speaker: 'atc',
          text: 'American 234, cleared for takeoff runway 25L, wind 250 at 12.',
        },
        {
          timestamp: new Date(Date.now() - 20000).toISOString(),
          speaker: 'pilot',
          text: 'Cleared for takeoff 25L, American 234.',
        },
        {
          timestamp: new Date(Date.now() - 10000).toISOString(),
          speaker: 'atc',
          text: 'Delta 567, contact SoCal departure 124.9.',
        },
      ],
    },
  });
});

app.route('/api/atc', atc);

// ============================================
// Image Analysis Endpoints
// ============================================

const images = new Hono();

// Analyze uploaded image
images.post('/analyze', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body['image'] as File;
    const analysisType = (body['type'] as string) || 'airport';
    const questionsRaw = body['questions'] as string;
    const questions = questionsRaw ? JSON.parse(questionsRaw) : undefined;
    
    if (!imageFile) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FILE', message: 'No image file provided' },
      }, 400);
    }
    
    const result = await analyzeImage(
      imageFile,
      analysisType as any,
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
images.post('/analyze-url', async (c) => {
  try {
    const { url, type = 'airport', questions } = await c.req.json();
    
    if (!url) {
      return c.json({
        success: false,
        error: { code: 'MISSING_URL', message: 'No image URL provided' },
      }, 400);
    }
    
    const result = await analyzeImage(url, type, questions);
    
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

// In-memory incident store (would be database in production)
const incidentStore: Incident[] = [
  {
    id: 'INC-001',
    source: 'faa',
    title: 'Runway Incursion at KJFK',
    description: 'Aircraft crossed active runway without clearance during low visibility operations.',
    occurred_at: new Date(Date.now() - 86400000).toISOString(),
    reported_at: new Date(Date.now() - 82800000).toISOString(),
    location: { airport_icao: 'KJFK', latitude: 40.6413, longitude: -73.7781, region: 'New York' },
    aircraft_involved: [{ callsign: 'DAL1234', type: 'A320', operator: 'Delta Air Lines' }],
    severity: 'serious',
    categories: ['runway_incursion', 'low_visibility'],
    status: 'investigating',
  },
  {
    id: 'INC-002',
    source: 'ntsb',
    title: 'Engine Failure on Departure KLAX',
    description: 'Single engine failure reported shortly after takeoff, aircraft returned safely.',
    occurred_at: new Date(Date.now() - 172800000).toISOString(),
    reported_at: new Date(Date.now() - 169200000).toISOString(),
    location: { airport_icao: 'KLAX', latitude: 33.9416, longitude: -118.4085, region: 'California' },
    aircraft_involved: [{ callsign: 'UAL789', type: 'B737', operator: 'United Airlines' }],
    severity: 'moderate',
    categories: ['mechanical_failure', 'engine'],
    status: 'preliminary',
  },
];

// Get all incidents
incidentsRouter.get('/', (c) => {
  const severity = c.req.query('severity');
  const source = c.req.query('source');
  const limit = parseInt(c.req.query('limit') || '50');
  
  let filtered = [...incidentStore];
  
  if (severity) filtered = filtered.filter(i => i.severity === severity);
  if (source) filtered = filtered.filter(i => i.source === source);
  
  filtered.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  
  return c.json({
    success: true,
    data: filtered.slice(0, limit),
    meta: { total: incidentStore.length },
  });
});

// Get incident by ID
incidentsRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const incident = incidentStore.find(i => i.id === id);
  
  if (!incident) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Incident ${id} not found` },
    }, 404);
  }
  
  return c.json({ success: true, data: incident });
});

// Generate incident briefing
incidentsRouter.post('/:id/briefing', async (c) => {
  try {
    const id = c.req.param('id');
    const incident = incidentStore.find(i => i.id === id);
    
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
incidentsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    
    const newIncident: Incident = {
      id: `INC-${Date.now()}`,
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
    
    incidentStore.push(newIncident);
    
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

app.post('/api/query', async (c) => {
  try {
    const { query, context } = await c.req.json();
    
    if (!query) {
      return c.json({
        success: false,
        error: { code: 'MISSING_QUERY', message: 'No query provided' },
      }, 400);
    }
    
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
        
      case 'incident_search':
        results = incidentStore.slice(0, 5);
        responseText = `Found ${results.length} recent incidents.`;
        break;
        
      case 'anomaly_report':
        results = anomalyStore.slice(0, 10);
        responseText = `${anomalyStore.length} anomalies detected recently.`;
        break;
        
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
    // Get current counts
    const datasetStatus = hfDatasetsClient.getStatus();
    const stats: DashboardStats = {
      flights_tracked: 0,
      active_anomalies: anomalyStore.filter(
        a => new Date(a.detected_at).getTime() > Date.now() - 3600000
      ).length,
      incidents_today: incidentStore.filter(
        i => new Date(i.occurred_at).toDateString() === new Date().toDateString()
      ).length,
      atc_communications_processed: 156,
      dataset_aircraft_loaded: datasetStatus.aircraftMetadata.count,
      dataset_incidents_loaded: datasetStatus.historicalIncidents.seedCount,
      last_updated: new Date().toISOString(),
    };
    
    // Try to get flight count from OpenSky
    try {
      const aircraft = await openSkyClient.getAllStates();
      stats.flights_tracked = aircraft.length;
    } catch {
      stats.flights_tracked = 12847;
    }
    
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

app.post('/api/embeddings', async (c) => {
  try {
    const { texts } = await c.req.json();
    
    if (!texts || !Array.isArray(texts)) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'texts must be an array of strings' },
      }, 400);
    }
    
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
  const limit = parseInt(c.req.query('limit') || '20');

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
    const offset = parseInt(c.req.query('offset') || '0');
    const limit = parseInt(c.req.query('limit') || '20');

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
    const offset = parseInt(c.req.query('offset') || '0');
    const limit = parseInt(c.req.query('limit') || '20');
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
    const offset = parseInt(c.req.query('offset') || '0');
    const limit = parseInt(c.req.query('limit') || '20');

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
    const offset = parseInt(c.req.query('offset') || '0');
    const limit = parseInt(c.req.query('limit') || '20');

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

(async () => {
  try {
    await hfDatasetsClient.initialize();
    console.log('HF Datasets service initialized');
  } catch (error) {
    console.error('HF Datasets initialization error:', error);
  }
})();

// ============================================
// Start Server
// ============================================

const port = parseInt(env.PORT);

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     █████╗ ██╗██████╗ ███████╗███████╗███╗   ██╗████████╗ ║
║    ██╔══██╗██║██╔══██╗██╔════╝██╔════╝████╗  ██║╚══██╔══╝ ║
║    ███████║██║██████╔╝███████╗█████╗  ██╔██╗ ██║   ██║    ║
║    ██╔══██║██║██╔══██╗╚════██║██╔══╝  ██║╚██╗██║   ██║    ║
║    ██║  ██║██║██║  ██║███████║███████╗██║ ╚████║   ██║    ║
║    ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝    ║
║                                                           ║
║         Multimodal Aviation Intelligence Platform         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

🚀 Server starting on port ${port}
📡 Mode: ${isDemoMode ? 'DEMO (AI features mocked)' : 'PRODUCTION'}
`);

export default {
  port,
  fetch: app.fetch,
};
