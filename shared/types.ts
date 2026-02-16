// ============================================
// AirSentinel AI - Shared Type Definitions
// ============================================

// Flight & Aircraft Types
export interface Aircraft {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  geo_altitude: number | null;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  on_ground: boolean;
  squawk: string | null;
  spi: boolean;
  position_source: number;
  last_contact: number;
  time_position: number | null;
  category: number | null;
}

export interface FlightTrack {
  icao24: string;
  callsign: string;
  startTime: number;
  endTime: number;
  path: FlightPathPoint[];
}

export interface FlightPathPoint {
  time: number;
  latitude: number | null;
  longitude: number | null;
  baro_altitude: number | null;
  true_track: number | null;
  on_ground: boolean;
}

// Anomaly Detection Types
export type AnomalyType = 
  | 'altitude_drop'
  | 'holding_pattern'
  | 'emergency_squawk'
  | 'route_deviation'
  | 'rapid_descent'
  | 'unusual_speed'
  | 'go_around'
  | 'diversion';

export interface FlightAnomaly {
  id: string;
  flight_icao24: string;
  callsign: string | null;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  location: {
    latitude: number;
    longitude: number;
  };
  details: {
    description: string;
    metrics?: Record<string, number>;
    previous_value?: number;
    current_value?: number;
  };
  ai_analysis?: string;
}

// Emergency Squawk Codes
export const EMERGENCY_SQUAWKS = {
  '7500': 'Hijacking',
  '7600': 'Radio Failure',
  '7700': 'General Emergency',
} as const;

// ATC Communication Types
export interface ATCTranscript {
  id: string;
  audio_url?: string;
  frequency: string;
  airport_icao?: string;
  timestamp: string;
  duration_seconds: number;
  raw_transcript: string;
  processed_transcript?: ProcessedTranscript;
}

export interface ProcessedTranscript {
  segments: TranscriptSegment[];
  summary: string;
  urgency_level: 'routine' | 'priority' | 'urgent' | 'emergency';
  detected_callsigns: string[];
  key_instructions: string[];
  sentiment_analysis?: {
    stress_indicators: number;
    urgency_markers: string[];
  };
}

export interface TranscriptSegment {
  speaker: 'pilot' | 'atc' | 'unknown';
  text: string;
  timestamp_offset: number;
  confidence: number;
  callsign?: string;
}

// Incident & Report Types
export interface Incident {
  id: string;
  source: 'faa' | 'ntsb' | 'news' | 'social' | 'user_report';
  source_url?: string;
  title: string;
  description: string;
  occurred_at: string;
  reported_at: string;
  location?: {
    airport_icao?: string;
    latitude?: number;
    longitude?: number;
    region?: string;
  };
  aircraft_involved?: {
    registration?: string;
    type?: string;
    operator?: string;
    callsign?: string;
  }[];
  severity: 'minor' | 'moderate' | 'serious' | 'fatal';
  categories: string[];
  status: 'reported' | 'investigating' | 'preliminary' | 'final';
  raw_data?: unknown;
}

export interface IncidentBriefing {
  incident_id: string;
  generated_at: string;
  executive_summary: string;
  timeline: TimelineEvent[];
  key_factors: string[];
  probable_causes?: string[];
  similar_incidents?: string[];
  recommendations?: string[];
  confidence_score: number;
  sources_used: string[];
}

export interface TimelineEvent {
  timestamp: string;
  description: string;
  source?: string;
  significance: 'low' | 'medium' | 'high';
}

// Image Analysis Types
export interface ImageAnalysisRequest {
  image_url?: string;
  image_base64?: string;
  analysis_type: 'satellite' | 'airport' | 'aircraft' | 'incident';
  questions?: string[];
}

export interface ImageAnalysisResult {
  id: string;
  analysis_type: string;
  description: string;
  detected_objects: DetectedObject[];
  answers?: QuestionAnswer[];
  risk_assessment?: {
    level: 'none' | 'low' | 'medium' | 'high';
    factors: string[];
  };
  metadata: {
    model_used: string;
    confidence: number;
    processing_time_ms: number;
  };
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  attributes?: Record<string, string>;
}

export interface QuestionAnswer {
  question: string;
  answer: string;
  confidence: number;
}

// Query & Search Types
export interface NaturalLanguageQuery {
  query: string;
  context?: {
    time_range?: { start: string; end: string };
    location?: { latitude: number; longitude: number; radius_nm: number };
    aircraft_types?: string[];
  };
}

export interface QueryResult {
  query_id: string;
  original_query: string;
  interpreted_intent: string;
  results: QueryResultItem[];
  summary: string;
  suggested_followups?: string[];
}

export interface QueryResultItem {
  type: 'flight' | 'incident' | 'transcript' | 'analysis';
  relevance_score: number;
  data: Aircraft | Incident | ATCTranscript | FlightAnomaly;
  explanation?: string;
}

// Dashboard & Monitoring Types
export interface DashboardStats {
  flights_tracked: number;
  active_anomalies: number;
  incidents_today: number;
  atc_communications_processed: number;
  last_updated: string;
}

export interface AlertConfig {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  conditions: AlertCondition[];
  notification_channels: ('email' | 'webhook' | 'push')[];
}

export interface AlertCondition {
  type: 'anomaly_type' | 'squawk_code' | 'location' | 'airline' | 'aircraft_type';
  operator: 'equals' | 'contains' | 'within_radius';
  value: string | number;
}

// WebSocket Message Types
export type WSMessageType = 
  | 'flight_update'
  | 'anomaly_detected'
  | 'incident_update'
  | 'transcript_ready'
  | 'analysis_complete'
  | 'alert_triggered';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  timestamp: string;
  payload: T;
}

// API Response Types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
    processing_time_ms?: number;
  };
}

// Weather Types (for context)
export interface WeatherData {
  airport_icao: string;
  metar_raw?: string;
  timestamp: string;
  conditions: {
    visibility_sm?: number;
    ceiling_ft?: number;
    wind_speed_kt?: number;
    wind_direction?: number;
    wind_gust_kt?: number;
    temperature_c?: number;
    dewpoint_c?: number;
    altimeter_inhg?: number;
    flight_category: 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
  };
  phenomena?: string[];
}

// Geospatial Types
export interface BoundingBox {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoCircle extends GeoPoint {
  radius_nm: number;
}

// Export utility type for API handlers
export type HandlerResponse<T> = Promise<APIResponse<T>>;
