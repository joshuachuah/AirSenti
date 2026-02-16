// ============================================
// AirSentinel AI - API Client & React Query Hooks
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api';

// Generic fetch wrapper
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.error?.message || error.message || 'Request failed');
  }
  
  const data = await response.json();
  return data.data || data;
}

// Types (simplified from shared types)
export interface Aircraft {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  on_ground: boolean;
  squawk: string | null;
}

export interface FlightAnomaly {
  id: string;
  flight_icao24: string;
  callsign: string | null;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  location: { latitude: number; longitude: number };
  details: { description: string };
  ai_analysis?: string;
}

export interface Incident {
  id: string;
  source: string;
  title: string;
  description: string;
  occurred_at: string;
  severity: string;
  status: string;
  location?: {
    airport_icao?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface AircraftMetadata {
  icao24: string;
  registration: string | null;
  manufacturerIcao: string | null;
  manufacturerName: string | null;
  model: string | null;
  typecode: string | null;
  icaoAircraftType: string | null;
  operator: string | null;
  operatorCallsign: string | null;
  owner: string | null;
  categoryDescription: string | null;
  built: string | null;
  engines: string | null;
}

export interface EnrichedAircraft extends Aircraft {
  metadata?: AircraftMetadata;
}

export interface HistoricalIncident {
  id: string;
  acnNumber: string;
  date: string | null;
  localTimeOfDay: string | null;
  localeReference: string | null;
  stateReference: string | null;
  altitudeMsl: string | null;
  flightConditions: string | null;
  light: string | null;
  aircraftOperator: string | null;
  aircraftMakeModel: string | null;
  flightPhase: string | null;
  anomaly: string | null;
  result: string | null;
  contributingFactors: string | null;
  primaryProblem: string | null;
  narrative: string;
  synopsis: string;
  humanFactors: string | null;
  source: string;
}

export interface HistoricalIncidentSearchResult {
  incidents: HistoricalIncident[];
  total: number;
  offset: number;
  hasMore: boolean;
}

export interface ATCDatasetEntry {
  id: string;
  text: string;
  source: string;
}

export interface ATCDatasetSearchResult {
  entries: ATCDatasetEntry[];
  total: number;
  offset: number;
  hasMore: boolean;
}

export interface DatasetServiceStatus {
  aircraftMetadata: {
    loaded: boolean;
    count: number;
    lastUpdated: string | null;
  };
  historicalIncidents: {
    loaded: boolean;
    seedCount: number;
    totalAvailable: number;
    lastUpdated: string | null;
  };
  atcTranscripts: {
    available: boolean;
    totalEntries: number;
  };
}

export interface DashboardStats {
  flights_tracked: number;
  active_anomalies: number;
  incidents_today: number;
  atc_communications_processed: number;
  dataset_aircraft_loaded: number;
  dataset_incidents_loaded: number;
  last_updated: string;
}

export interface QueryResult {
  query_id: string;
  original_query: string;
  interpreted_intent: string;
  response: string;
  results: any[];
  suggested_followups: string[];
}

// ============================================
// Query Hooks
// ============================================

// Dashboard stats
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<DashboardStats>('/dashboard/stats'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Flights
export function useFlights(options?: { limit?: number }) {
  return useQuery({
    queryKey: ['flights', options],
    queryFn: () => apiFetch<{ aircraft: EnrichedAircraft[]; anomalies: FlightAnomaly[] }>(
      `/flights?limit=${options?.limit || 100}`
    ),
    refetchInterval: 15000, // Refresh every 15 seconds
  });
}

export function useFlightsByArea(bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }) {
  return useQuery({
    queryKey: ['flights', 'area', bbox],
    queryFn: () => apiFetch<{ aircraft: EnrichedAircraft[]; anomalies: FlightAnomaly[] }>(
      `/flights/area?min_lat=${bbox.minLat}&max_lat=${bbox.maxLat}&min_lon=${bbox.minLon}&max_lon=${bbox.maxLon}`
    ),
    refetchInterval: 15000,
    enabled: !!(bbox.minLat && bbox.maxLat && bbox.minLon && bbox.maxLon),
  });
}

export function useFlightsByRadius(center: { lat: number; lon: number; radiusNm?: number }) {
  return useQuery({
    queryKey: ['flights', 'radius', center],
    queryFn: () => apiFetch<{ aircraft: EnrichedAircraft[]; anomalies: FlightAnomaly[] }>(
      `/flights/radius?lat=${center.lat}&lon=${center.lon}&radius_nm=${center.radiusNm || 50}`
    ),
    refetchInterval: 15000,
    enabled: !!(center.lat && center.lon),
  });
}

export function useFlight(icao24: string) {
  return useQuery({
    queryKey: ['flights', icao24],
    queryFn: () => apiFetch<{ aircraft: EnrichedAircraft; anomalies: FlightAnomaly[] }>(`/flights/${icao24}`),
    enabled: !!icao24,
  });
}

export function useFlightTrack(icao24: string) {
  return useQuery({
    queryKey: ['flights', icao24, 'track'],
    queryFn: () => apiFetch<any>(`/flights/${icao24}/track`),
    enabled: !!icao24,
  });
}

// Anomalies
export function useAnomalies(options?: { severity?: string; type?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.severity) params.append('severity', options.severity);
  if (options?.type) params.append('type', options.type);
  if (options?.limit) params.append('limit', options.limit.toString());
  
  return useQuery({
    queryKey: ['anomalies', options],
    queryFn: () => apiFetch<FlightAnomaly[]>(`/anomalies?${params}`),
    refetchInterval: 10000, // Refresh every 10 seconds for alerts
  });
}

export function useAnalyzeAnomaly() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (anomalyId: string) => 
      apiFetch<FlightAnomaly>(`/anomalies/${anomalyId}/analyze`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
    },
  });
}

// Incidents
export function useIncidents(options?: { severity?: string; source?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.severity) params.append('severity', options.severity);
  if (options?.source) params.append('source', options.source);
  if (options?.limit) params.append('limit', options.limit.toString());
  
  return useQuery({
    queryKey: ['incidents', options],
    queryFn: () => apiFetch<Incident[]>(`/incidents?${params}`),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: ['incidents', id],
    queryFn: () => apiFetch<Incident>(`/incidents/${id}`),
    enabled: !!id,
  });
}

export function useGenerateBriefing() {
  return useMutation({
    mutationFn: (incidentId: string) => 
      apiFetch<any>(`/incidents/${incidentId}/briefing`, { method: 'POST' }),
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (incident: Partial<Incident>) => 
      apiFetch<Incident>('/incidents', {
        method: 'POST',
        body: JSON.stringify(incident),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}

// ATC
export function useLiveATC(frequency?: string) {
  return useQuery({
    queryKey: ['atc', 'live', frequency],
    queryFn: () => apiFetch<any>(`/atc/live${frequency ? `?frequency=${frequency}` : ''}`),
    refetchInterval: 5000, // Refresh every 5 seconds for live data
  });
}

export function useTranscribeAudio() {
  return useMutation({
    mutationFn: async (audioFile: File) => {
      const formData = new FormData();
      formData.append('audio', audioFile);
      
      const response = await fetch(`${API_BASE}/atc/transcribe`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Transcription failed');
      const data = await response.json();
      return data.data;
    },
  });
}

// Natural Language Query
export function useNaturalQuery() {
  return useMutation({
    mutationFn: (query: string) => 
      apiFetch<QueryResult>('/query', {
        method: 'POST',
        body: JSON.stringify({ query }),
      }),
  });
}

// Image Analysis
export function useAnalyzeImage() {
  return useMutation({
    mutationFn: async ({ file, type, questions }: { file: File; type: string; questions?: string[] }) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('type', type);
      if (questions) formData.append('questions', JSON.stringify(questions));
      
      const response = await fetch(`${API_BASE}/images/analyze`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      return data.data;
    },
  });
}

export function useAnalyzeImageUrl() {
  return useMutation({
    mutationFn: ({ url, type, questions }: { url: string; type: string; questions?: string[] }) =>
      apiFetch<any>('/images/analyze-url', {
        method: 'POST',
        body: JSON.stringify({ url, type, questions }),
      }),
  });
}

// ============================================
// HF Dataset Hooks
// ============================================

export function useDatasetStatus() {
  return useQuery({
    queryKey: ['datasets', 'status'],
    queryFn: () => apiFetch<DatasetServiceStatus>('/datasets/status'),
    refetchInterval: 60000,
  });
}

export function useAircraftMetadata(icao24: string) {
  return useQuery({
    queryKey: ['datasets', 'aircraft', icao24],
    queryFn: () => apiFetch<AircraftMetadata>(`/datasets/aircraft/${icao24}`),
    enabled: !!icao24,
    staleTime: 3600000,
  });
}

export function useAircraftSearch(params: {
  registration?: string;
  typecode?: string;
  manufacturer?: string;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.registration) searchParams.append('registration', params.registration);
  if (params.typecode) searchParams.append('typecode', params.typecode);
  if (params.manufacturer) searchParams.append('manufacturer', params.manufacturer);
  if (params.limit) searchParams.append('limit', params.limit.toString());

  return useQuery({
    queryKey: ['datasets', 'aircraft', 'search', params],
    queryFn: () => apiFetch<AircraftMetadata[]>(`/datasets/aircraft?${searchParams}`),
    enabled: !!(params.registration || params.typecode || params.manufacturer),
    staleTime: 300000,
  });
}

export function useHistoricalIncidentSearch(query: string, options?: {
  offset?: number;
  limit?: number;
  enabled?: boolean;
}) {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  return useQuery({
    queryKey: ['datasets', 'incidents', 'search', query, options],
    queryFn: () => apiFetch<HistoricalIncidentSearchResult>(
      `/datasets/incidents/search?${params}`
    ),
    enabled: options?.enabled !== false && !!query,
    staleTime: 60000,
  });
}

export function useHistoricalIncidents(options?: {
  offset?: number;
  limit?: number;
  primaryProblem?: string;
  flightPhase?: string;
}) {
  const params = new URLSearchParams();
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.limit) params.append('limit', (options.limit || 20).toString());
  if (options?.primaryProblem) params.append('primary_problem', options.primaryProblem);
  if (options?.flightPhase) params.append('flight_phase', options.flightPhase);

  return useQuery({
    queryKey: ['datasets', 'incidents', options],
    queryFn: () => apiFetch<HistoricalIncidentSearchResult>(
      `/datasets/incidents?${params}`
    ),
    staleTime: 120000,
  });
}

export function useHistoricalIncident(id: string) {
  return useQuery({
    queryKey: ['datasets', 'incidents', id],
    queryFn: () => apiFetch<HistoricalIncident>(`/datasets/incidents/${id}`),
    enabled: !!id,
    staleTime: 300000,
  });
}

export function useATCDataset(options?: { offset?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.limit) params.append('limit', (options.limit || 20).toString());

  return useQuery({
    queryKey: ['datasets', 'atc', options],
    queryFn: () => apiFetch<ATCDatasetSearchResult>(`/datasets/atc?${params}`),
    staleTime: 120000,
  });
}

export function useATCDatasetSearch(query: string) {
  const params = new URLSearchParams();
  if (query) params.append('q', query);

  return useQuery({
    queryKey: ['datasets', 'atc', 'search', query],
    queryFn: () => apiFetch<ATCDatasetSearchResult>(`/datasets/atc/search?${params}`),
    enabled: !!query,
    staleTime: 60000,
  });
}
