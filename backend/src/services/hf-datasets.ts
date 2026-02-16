// ============================================
// AirSentinel AI - HuggingFace Datasets Service
// ============================================

import { env, isDatasetsEnabled } from '../config/env';
import type {
  Aircraft,
  AircraftMetadata,
  EnrichedAircraft,
  HistoricalIncident,
  HistoricalIncidentSearchResult,
  ATCDatasetEntry,
  ATCDatasetSearchResult,
  DatasetServiceStatus,
} from '../../../shared/types';

// ============================================
// Constants
// ============================================

const HF_DATASETS_API = 'https://datasets-server.huggingface.co';
const AIRCRAFT_DB_URL = 'https://opensky-network.org/datasets/metadata/aircraftDatabase.csv';

const ASRS_DATASET = 'elihoole/asrs-aviation-reports';
const ASRS_CONFIG = 'default';
const ASRS_SPLIT = 'train';

const ATC_DATASET = 'jacktol/atc-dataset';
const ATC_CONFIG = 'default';
const ATC_SPLIT = 'train';

// ASRS column name mappings (verbose HF names -> our field names)
const ASRS_COLUMNS: Record<string, keyof HistoricalIncident> = {
  'acn_num_ACN': 'acnNumber',
  'Time_Date': 'date',
  'Time.1_Local Time Of Day': 'localTimeOfDay',
  'Place_Locale Reference': 'localeReference',
  'Place.1_State Reference': 'stateReference',
  'Place.5_Altitude.MSL.Single Value': 'altitudeMsl',
  'Environment_Flight Conditions': 'flightConditions',
  'Environment.3_Light': 'light',
  'Aircraft 1.1_Aircraft Operator': 'aircraftOperator',
  'Aircraft 1.2_Make Model Name': 'aircraftMakeModel',
  'Aircraft 1.9_Flight Phase': 'flightPhase',
  'Events_Anomaly': 'anomaly',
  'Events.5_Result': 'result',
  'Assessments_Contributing Factors / Situations': 'contributingFactors',
  'Assessments.1_Primary Problem': 'primaryProblem',
  'Report 1_Narrative': 'narrative',
  'Report 1.2_Synopsis': 'synopsis',
  'Person 1.7_Human Factors': 'humanFactors',
};

// ============================================
// Rate Limiter
// ============================================

let lastDatasetRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastDatasetRequestTime;
  const minInterval = env.HF_DATASETS_RATE_LIMIT_MS;

  if (timeSinceLastRequest < minInterval) {
    await new Promise(resolve =>
      setTimeout(resolve, minInterval - timeSinceLastRequest)
    );
  }
  lastDatasetRequestTime = Date.now();

  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (env.HUGGINGFACE_API_KEY) {
    headers['Authorization'] = `Bearer ${env.HUGGINGFACE_API_KEY}`;
  }

  return fetch(url, { headers });
}

// ============================================
// CSV Parser (for OpenSky aircraft database)
// ============================================

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

// ============================================
// HF Datasets Client
// ============================================

class HFDatasetsClient {
  private aircraftStore = new Map<string, AircraftMetadata>();
  private registrationIndex = new Map<string, string>();
  private incidentCache = new Map<string, HistoricalIncident>();
  private aircraftLastUpdated: string | null = null;
  private incidentsLastUpdated: string | null = null;
  private incidentsTotalAvailable = 0;
  private atcAvailable = false;
  private atcTotalEntries = 0;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ==========================================
  // Initialization
  // ==========================================

  async initialize(): Promise<void> {
    if (!isDatasetsEnabled) {
      console.log('  HF Datasets disabled, using mock data');
      this.loadMockData();
      return;
    }

    console.log('  Initializing HF Datasets...');

    // Load aircraft metadata in background (don't block startup)
    this.loadAircraftMetadata().catch(err => {
      console.error('  Failed to load aircraft metadata:', err.message);
      this.loadMockAircraftMetadata();
    });

    // Seed historical incidents
    this.seedIncidents().catch(err => {
      console.error('  Failed to seed historical incidents:', err.message);
      this.loadMockIncidents();
    });

    // Check ATC dataset availability
    this.checkATCAvailability().catch(err => {
      console.error('  ATC dataset unavailable:', err.message);
    });

    // Schedule periodic aircraft DB refresh
    this.scheduleRefresh();
  }

  // ==========================================
  // Aircraft Metadata
  // ==========================================

  async loadAircraftMetadata(): Promise<void> {
    console.log('  Loading OpenSky aircraft database...');
    const startTime = Date.now();

    const response = await fetch(AIRCRAFT_DB_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch aircraft DB: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.split('\n');

    // Parse header to get column indices
    const header = parseCSVLine(lines[0]);
    const icao24Idx = header.indexOf('icao24');
    const regIdx = header.indexOf('registration');
    const mfgIcaoIdx = header.indexOf('manufacturericao');
    const mfgNameIdx = header.indexOf('manufacturername');
    const modelIdx = header.indexOf('model');
    const typecodeIdx = header.indexOf('typecode');
    const serialIdx = header.indexOf('serialnumber');
    const acTypeIdx = header.indexOf('icaoaircrafttype');
    const operatorIdx = header.indexOf('operator');
    const opCallsignIdx = header.indexOf('operatorcallsign');
    const opIcaoIdx = header.indexOf('operatoricao');
    const ownerIdx = header.indexOf('owner');
    const builtIdx = header.indexOf('built');
    const firstFlightIdx = header.indexOf('firstflightdate');
    const categoryIdx = header.indexOf('categorydescription');
    const enginesIdx = header.indexOf('engines');

    let loaded = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = parseCSVLine(line);
      const icao24 = fields[icao24Idx]?.toLowerCase();
      if (!icao24) continue;

      // Only load aircraft with a typecode to save memory
      const typecode = fields[typecodeIdx] || null;
      if (!typecode) continue;

      const metadata: AircraftMetadata = {
        icao24,
        registration: fields[regIdx] || null,
        manufacturerIcao: fields[mfgIcaoIdx] || null,
        manufacturerName: fields[mfgNameIdx] || null,
        model: fields[modelIdx] || null,
        typecode,
        serialNumber: fields[serialIdx] || null,
        icaoAircraftType: fields[acTypeIdx] || null,
        operator: fields[operatorIdx] || null,
        operatorCallsign: fields[opCallsignIdx] || null,
        operatorIcao: fields[opIcaoIdx] || null,
        owner: fields[ownerIdx] || null,
        categoryDescription: fields[categoryIdx] || null,
        built: fields[builtIdx] || null,
        firstFlightDate: fields[firstFlightIdx] || null,
        engines: fields[enginesIdx] || null,
      };

      this.aircraftStore.set(icao24, metadata);
      if (metadata.registration) {
        this.registrationIndex.set(
          metadata.registration.toUpperCase(),
          icao24
        );
      }
      loaded++;
    }

    this.aircraftLastUpdated = new Date().toISOString();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  Aircraft metadata loaded: ${loaded.toLocaleString()} entries in ${elapsed}s`);
  }

  lookupAircraft(icao24: string): AircraftMetadata | undefined {
    return this.aircraftStore.get(icao24.toLowerCase());
  }

  enrichAircraft(aircraft: Aircraft): EnrichedAircraft {
    const metadata = this.aircraftStore.get(aircraft.icao24.toLowerCase());
    return { ...aircraft, metadata: metadata || undefined };
  }

  enrichAircraftBatch(aircraftList: Aircraft[]): EnrichedAircraft[] {
    return aircraftList.map(ac => this.enrichAircraft(ac));
  }

  searchAircraft(params: {
    registration?: string;
    typecode?: string;
    manufacturer?: string;
    limit?: number;
  }): AircraftMetadata[] {
    const limit = params.limit || 20;
    const results: AircraftMetadata[] = [];

    // Fast path: registration lookup
    if (params.registration && !params.typecode && !params.manufacturer) {
      const icao24 = this.registrationIndex.get(params.registration.toUpperCase());
      if (icao24) {
        const meta = this.aircraftStore.get(icao24);
        if (meta) return [meta];
      }
      return [];
    }

    // Filtered scan
    for (const meta of this.aircraftStore.values()) {
      if (results.length >= limit) break;

      let matches = true;
      if (params.registration) {
        matches = matches && (meta.registration?.toUpperCase().includes(params.registration.toUpperCase()) || false);
      }
      if (params.typecode) {
        matches = matches && (meta.typecode?.toUpperCase() === params.typecode.toUpperCase());
      }
      if (params.manufacturer) {
        matches = matches && (
          meta.manufacturerName?.toLowerCase().includes(params.manufacturer.toLowerCase()) || false
        );
      }

      if (matches) results.push(meta);
    }

    return results;
  }

  // ==========================================
  // Historical Incidents (ASRS)
  // ==========================================

  async seedIncidents(): Promise<void> {
    const seedCount = env.HF_INCIDENT_SEED_COUNT;
    console.log(`  Seeding ${seedCount} historical incidents from ASRS...`);

    const url = `${HF_DATASETS_API}/rows?dataset=${ASRS_DATASET}&config=${ASRS_CONFIG}&split=${ASRS_SPLIT}&offset=0&length=${Math.min(seedCount, 100)}`;
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ASRS rows: ${response.status}`);
    }

    const data = await response.json() as {
      rows: Array<{ row_idx: number; row: Record<string, string> }>;
      num_rows_total: number;
    };

    this.incidentsTotalAvailable = data.num_rows_total;

    for (const { row_idx, row } of data.rows) {
      const incident = this.parseASRSRow(row_idx, row);
      this.incidentCache.set(incident.id, incident);
    }

    // If seed count > 100, fetch additional batches
    if (seedCount > 100) {
      let offset = 100;
      while (offset < seedCount) {
        const batchSize = Math.min(100, seedCount - offset);
        const batchUrl = `${HF_DATASETS_API}/rows?dataset=${ASRS_DATASET}&config=${ASRS_CONFIG}&split=${ASRS_SPLIT}&offset=${offset}&length=${batchSize}`;

        try {
          const batchResp = await rateLimitedFetch(batchUrl);
          if (!batchResp.ok) break;

          const batchData = await batchResp.json() as {
            rows: Array<{ row_idx: number; row: Record<string, string> }>;
          };

          for (const { row_idx, row } of batchData.rows) {
            const incident = this.parseASRSRow(row_idx, row);
            this.incidentCache.set(incident.id, incident);
          }
        } catch {
          break;
        }

        offset += batchSize;
      }
    }

    this.incidentsLastUpdated = new Date().toISOString();
    console.log(`  Historical incidents seeded: ${this.incidentCache.size} entries`);
  }

  async searchIncidents(
    query: string,
    offset: number = 0,
    limit: number = 20
  ): Promise<HistoricalIncidentSearchResult> {
    if (!isDatasetsEnabled) {
      return this.getMockIncidentSearch(query, offset, limit);
    }

    // Try HF search endpoint
    try {
      const url = `${HF_DATASETS_API}/search?dataset=${ASRS_DATASET}&config=${ASRS_CONFIG}&split=${ASRS_SPLIT}&query=${encodeURIComponent(query)}&offset=${offset}&length=${limit}`;
      const response = await rateLimitedFetch(url);

      if (response.ok) {
        const data = await response.json() as {
          rows: Array<{ row_idx: number; row: Record<string, string> }>;
          num_rows_total: number;
          num_rows_per_page: number;
        };

        const incidents = data.rows.map(({ row_idx, row }) =>
          this.parseASRSRow(row_idx, row)
        );

        return {
          incidents,
          total: data.num_rows_total,
          offset,
          hasMore: offset + incidents.length < data.num_rows_total,
        };
      }
    } catch (err) {
      console.error('HF search failed, falling back to local cache:', err);
    }

    // Fallback: search local cache
    return this.searchLocalIncidents(query, offset, limit);
  }

  async browseIncidents(params: {
    offset?: number;
    limit?: number;
    primaryProblem?: string;
    flightPhase?: string;
  }): Promise<HistoricalIncidentSearchResult> {
    const offset = params.offset || 0;
    const limit = params.limit || 20;

    if (!isDatasetsEnabled) {
      return this.getMockIncidentSearch('', offset, limit);
    }

    // If filtering, search local cache first
    if (params.primaryProblem || params.flightPhase) {
      return this.filterLocalIncidents(params);
    }

    // Otherwise fetch from HF API
    try {
      const url = `${HF_DATASETS_API}/rows?dataset=${ASRS_DATASET}&config=${ASRS_CONFIG}&split=${ASRS_SPLIT}&offset=${offset}&length=${limit}`;
      const response = await rateLimitedFetch(url);

      if (response.ok) {
        const data = await response.json() as {
          rows: Array<{ row_idx: number; row: Record<string, string> }>;
          num_rows_total: number;
        };

        const incidents = data.rows.map(({ row_idx, row }) => {
          const incident = this.parseASRSRow(row_idx, row);
          this.incidentCache.set(incident.id, incident);
          return incident;
        });

        return {
          incidents,
          total: data.num_rows_total,
          offset,
          hasMore: offset + incidents.length < data.num_rows_total,
        };
      }
    } catch (err) {
      console.error('Failed to browse incidents from HF:', err);
    }

    // Fallback to local cache
    const cached = Array.from(this.incidentCache.values());
    return {
      incidents: cached.slice(offset, offset + limit),
      total: cached.length,
      offset,
      hasMore: offset + limit < cached.length,
    };
  }

  async getHistoricalIncident(id: string): Promise<HistoricalIncident | undefined> {
    // Check cache first
    const cached = this.incidentCache.get(id);
    if (cached) return cached;

    // Try to fetch by row index from HF
    const rowIdx = parseInt(id.replace('asrs-', ''));
    if (isNaN(rowIdx)) return undefined;

    if (!isDatasetsEnabled) return undefined;

    try {
      const url = `${HF_DATASETS_API}/rows?dataset=${ASRS_DATASET}&config=${ASRS_CONFIG}&split=${ASRS_SPLIT}&offset=${rowIdx}&length=1`;
      const response = await rateLimitedFetch(url);

      if (response.ok) {
        const data = await response.json() as {
          rows: Array<{ row_idx: number; row: Record<string, string> }>;
        };

        if (data.rows.length > 0) {
          const incident = this.parseASRSRow(data.rows[0].row_idx, data.rows[0].row);
          this.incidentCache.set(incident.id, incident);
          return incident;
        }
      }
    } catch (err) {
      console.error('Failed to fetch incident:', err);
    }

    return undefined;
  }

  private parseASRSRow(
    rowIdx: number,
    row: Record<string, string>
  ): HistoricalIncident {
    return {
      id: `asrs-${rowIdx}`,
      acnNumber: row['acn_num_ACN'] || String(rowIdx),
      date: row['Time_Date'] || null,
      localTimeOfDay: row['Time.1_Local Time Of Day'] || null,
      localeReference: row['Place_Locale Reference'] || null,
      stateReference: row['Place.1_State Reference'] || null,
      altitudeMsl: row['Place.5_Altitude.MSL.Single Value'] || null,
      flightConditions: row['Environment_Flight Conditions'] || null,
      light: row['Environment.3_Light'] || null,
      aircraftOperator: row['Aircraft 1.1_Aircraft Operator'] || null,
      aircraftMakeModel: row['Aircraft 1.2_Make Model Name'] || null,
      flightPhase: row['Aircraft 1.9_Flight Phase'] || null,
      anomaly: row['Events_Anomaly'] || null,
      result: row['Events.5_Result'] || null,
      contributingFactors: row['Assessments_Contributing Factors / Situations'] || null,
      primaryProblem: row['Assessments.1_Primary Problem'] || null,
      narrative: row['Report 1_Narrative'] || '',
      synopsis: row['Report 1.2_Synopsis'] || '',
      humanFactors: row['Person 1.7_Human Factors'] || null,
      source: 'asrs',
    };
  }

  private searchLocalIncidents(
    query: string,
    offset: number,
    limit: number
  ): HistoricalIncidentSearchResult {
    const queryLower = query.toLowerCase();
    const matches = Array.from(this.incidentCache.values()).filter(incident =>
      incident.narrative.toLowerCase().includes(queryLower) ||
      incident.synopsis.toLowerCase().includes(queryLower) ||
      incident.aircraftMakeModel?.toLowerCase().includes(queryLower) ||
      incident.primaryProblem?.toLowerCase().includes(queryLower) ||
      incident.anomaly?.toLowerCase().includes(queryLower)
    );

    return {
      incidents: matches.slice(offset, offset + limit),
      total: matches.length,
      offset,
      hasMore: offset + limit < matches.length,
    };
  }

  private filterLocalIncidents(params: {
    offset?: number;
    limit?: number;
    primaryProblem?: string;
    flightPhase?: string;
  }): HistoricalIncidentSearchResult {
    const offset = params.offset || 0;
    const limit = params.limit || 20;

    const matches = Array.from(this.incidentCache.values()).filter(incident => {
      if (params.primaryProblem && incident.primaryProblem !== params.primaryProblem) return false;
      if (params.flightPhase && incident.flightPhase !== params.flightPhase) return false;
      return true;
    });

    return {
      incidents: matches.slice(offset, offset + limit),
      total: matches.length,
      offset,
      hasMore: offset + limit < matches.length,
    };
  }

  // ==========================================
  // ATC Transcripts
  // ==========================================

  async checkATCAvailability(): Promise<void> {
    try {
      const url = `${HF_DATASETS_API}/size?dataset=${ATC_DATASET}`;
      const response = await rateLimitedFetch(url);

      if (response.ok) {
        const data = await response.json() as {
          size: { dataset: { num_rows: number } };
        };
        this.atcAvailable = true;
        this.atcTotalEntries = data.size?.dataset?.num_rows || 0;
        console.log(`  ATC dataset available: ${this.atcTotalEntries.toLocaleString()} entries`);
      }
    } catch {
      this.atcAvailable = false;
    }
  }

  async getATCTranscripts(
    offset: number = 0,
    limit: number = 20
  ): Promise<ATCDatasetSearchResult> {
    if (!isDatasetsEnabled || !this.atcAvailable) {
      return this.getMockATCData(offset, limit);
    }

    try {
      const url = `${HF_DATASETS_API}/rows?dataset=${ATC_DATASET}&config=${ATC_CONFIG}&split=${ATC_SPLIT}&offset=${offset}&length=${limit}`;
      const response = await rateLimitedFetch(url);

      if (response.ok) {
        const data = await response.json() as {
          rows: Array<{ row_idx: number; row: Record<string, string> }>;
          num_rows_total: number;
        };

        const entries: ATCDatasetEntry[] = data.rows.map(({ row_idx, row }) => ({
          id: `atc-${row_idx}`,
          text: row['text'] || '',
          source: 'jacktol/atc-dataset',
        }));

        return {
          entries,
          total: data.num_rows_total,
          offset,
          hasMore: offset + entries.length < data.num_rows_total,
        };
      }
    } catch (err) {
      console.error('Failed to fetch ATC transcripts:', err);
    }

    return this.getMockATCData(offset, limit);
  }

  async searchATCTranscripts(
    query: string,
    offset: number = 0,
    limit: number = 20
  ): Promise<ATCDatasetSearchResult> {
    if (!isDatasetsEnabled || !this.atcAvailable) {
      return this.getMockATCData(offset, limit);
    }

    try {
      const url = `${HF_DATASETS_API}/search?dataset=${ATC_DATASET}&config=${ATC_CONFIG}&split=${ATC_SPLIT}&query=${encodeURIComponent(query)}&offset=${offset}&length=${limit}`;
      const response = await rateLimitedFetch(url);

      if (response.ok) {
        const data = await response.json() as {
          rows: Array<{ row_idx: number; row: Record<string, string> }>;
          num_rows_total: number;
        };

        const entries: ATCDatasetEntry[] = data.rows.map(({ row_idx, row }) => ({
          id: `atc-${row_idx}`,
          text: row['text'] || '',
          source: 'jacktol/atc-dataset',
        }));

        return {
          entries,
          total: data.num_rows_total,
          offset,
          hasMore: offset + entries.length < data.num_rows_total,
        };
      }
    } catch (err) {
      console.error('Failed to search ATC transcripts:', err);
    }

    return this.getMockATCData(offset, limit);
  }

  // ==========================================
  // Service Status
  // ==========================================

  getStatus(): DatasetServiceStatus {
    return {
      aircraftMetadata: {
        loaded: this.aircraftStore.size > 0,
        count: this.aircraftStore.size,
        lastUpdated: this.aircraftLastUpdated,
      },
      historicalIncidents: {
        loaded: this.incidentCache.size > 0,
        seedCount: this.incidentCache.size,
        totalAvailable: this.incidentsTotalAvailable,
        lastUpdated: this.incidentsLastUpdated,
      },
      atcTranscripts: {
        available: this.atcAvailable,
        totalEntries: this.atcTotalEntries,
      },
    };
  }

  // ==========================================
  // Refresh Scheduling
  // ==========================================

  private scheduleRefresh(): void {
    const intervalMs = env.AIRCRAFT_DB_REFRESH_HOURS * 60 * 60 * 1000;
    this.refreshTimer = setInterval(() => {
      console.log('  Refreshing aircraft metadata...');
      this.loadAircraftMetadata().catch(err => {
        console.error('  Aircraft metadata refresh failed:', err.message);
      });
    }, intervalMs);
  }

  // ==========================================
  // Mock Data (for demo/offline mode)
  // ==========================================

  private loadMockData(): void {
    this.loadMockAircraftMetadata();
    this.loadMockIncidents();
    this.atcAvailable = true;
    this.atcTotalEntries = 50;
  }

  private loadMockAircraftMetadata(): void {
    const mockAircraft: Array<[string, Partial<AircraftMetadata>]> = [
      ['a00001', { registration: 'N12345', manufacturerName: 'Boeing', model: '737-800', typecode: 'B738', operator: 'United Airlines', icaoAircraftType: 'L2J', engines: 'CFM56-7B' }],
      ['a00002', { registration: 'N67890', manufacturerName: 'Airbus', model: 'A320-214', typecode: 'A320', operator: 'Delta Air Lines', icaoAircraftType: 'L2J', engines: 'CFM56-5B4' }],
      ['a00003', { registration: 'N11111', manufacturerName: 'Embraer', model: 'ERJ-175LR', typecode: 'E75L', operator: 'Republic Airways', icaoAircraftType: 'L2J', engines: 'CF34-8E5' }],
      ['a00004', { registration: 'N22222', manufacturerName: 'Boeing', model: '777-300ER', typecode: 'B77W', operator: 'American Airlines', icaoAircraftType: 'L2J', engines: 'GE90-115B' }],
      ['a00005', { registration: 'N33333', manufacturerName: 'Cessna', model: '172S Skyhawk', typecode: 'C172', operator: 'Private', icaoAircraftType: 'L1P', engines: 'IO-360-L2A' }],
      ['a00006', { registration: 'N44444', manufacturerName: 'Boeing', model: '787-9 Dreamliner', typecode: 'B789', operator: 'United Airlines', icaoAircraftType: 'L2J', engines: 'GEnx-1B' }],
      ['a00007', { registration: 'N55555', manufacturerName: 'Airbus', model: 'A321-271NX', typecode: 'A21N', operator: 'JetBlue Airways', icaoAircraftType: 'L2J', engines: 'PW1133G' }],
      ['a00008', { registration: 'N66666', manufacturerName: 'Robinson', model: 'R44 Raven II', typecode: 'R44', operator: 'Private', icaoAircraftType: 'H1P', engines: 'IO-540' }],
    ];

    for (const [icao24, partial] of mockAircraft) {
      const metadata: AircraftMetadata = {
        icao24,
        registration: partial.registration || null,
        manufacturerIcao: null,
        manufacturerName: partial.manufacturerName || null,
        model: partial.model || null,
        typecode: partial.typecode || null,
        serialNumber: null,
        icaoAircraftType: partial.icaoAircraftType || null,
        operator: partial.operator || null,
        operatorCallsign: null,
        operatorIcao: null,
        owner: null,
        categoryDescription: null,
        built: null,
        firstFlightDate: null,
        engines: partial.engines || null,
      };
      this.aircraftStore.set(icao24, metadata);
      if (metadata.registration) {
        this.registrationIndex.set(metadata.registration.toUpperCase(), icao24);
      }
    }

    this.aircraftLastUpdated = new Date().toISOString();
    console.log(`  Mock aircraft metadata loaded: ${this.aircraftStore.size} entries`);
  }

  private loadMockIncidents(): void {
    const mockIncidents: HistoricalIncident[] = [
      {
        id: 'asrs-0',
        acnNumber: '1574675',
        date: '201808',
        localTimeOfDay: '1200-1800',
        localeReference: 'SNA.Airport',
        stateReference: 'California',
        altitudeMsl: '3000',
        flightConditions: 'VMC',
        light: 'Daylight',
        aircraftOperator: 'Air Carrier',
        aircraftMakeModel: 'B737-700',
        flightPhase: 'Initial Approach',
        anomaly: 'Deviation / Discrepancy - Procedural',
        result: 'General',
        contributingFactors: 'Human Factors',
        primaryProblem: 'Human Factors',
        narrative: 'B737-700 flight crew reported failing to make a crossing restriction on the RNP-Z Runway 20R approach to SNA. Contributing factors included high workload and late configuration.',
        synopsis: 'B737-700 crew missed crossing restriction on RNP approach due to late configuration and high workload.',
        humanFactors: 'Situational Awareness; Workload',
        source: 'asrs',
      },
      {
        id: 'asrs-1',
        acnNumber: '1580432',
        date: '201809',
        localTimeOfDay: '0601-1200',
        localeReference: 'ORD.Airport',
        stateReference: 'Illinois',
        altitudeMsl: '2500',
        flightConditions: 'IMC',
        light: 'Daylight',
        aircraftOperator: 'Air Carrier',
        aircraftMakeModel: 'A320-200',
        flightPhase: 'Final Approach',
        anomaly: 'Conflict - NMAC',
        result: 'Deviation - Altitude; Maneuver',
        contributingFactors: 'ATC Issue',
        primaryProblem: 'ATC Issue',
        narrative: 'A320 crew reported a near mid-air collision on final approach to ORD when a regional jet crossed their path. ATC had failed to maintain proper separation between arriving aircraft.',
        synopsis: 'A320 crew experienced NMAC on final to ORD due to ATC separation failure with crossing regional jet.',
        humanFactors: 'Situational Awareness; Communication',
        source: 'asrs',
      },
      {
        id: 'asrs-2',
        acnNumber: '1590100',
        date: '201810',
        localTimeOfDay: '1801-2400',
        localeReference: 'DEN.Airport',
        stateReference: 'Colorado',
        altitudeMsl: '8000',
        flightConditions: 'VMC',
        light: 'Night',
        aircraftOperator: 'Air Carrier',
        aircraftMakeModel: 'B787-9',
        flightPhase: 'Climb',
        anomaly: 'Deviation / Discrepancy - Procedural',
        result: 'General',
        contributingFactors: 'Human Factors; Procedure',
        primaryProblem: 'Human Factors',
        narrative: 'B787-9 crew reported receiving a TCAS RA during departure from DEN. Crew responded appropriately and coordinated with ATC for re-sequencing.',
        synopsis: 'B787-9 crew received TCAS RA during departure climb from DEN, requiring deviation and re-sequencing.',
        humanFactors: 'Workload; Time Pressure',
        source: 'asrs',
      },
    ];

    for (const incident of mockIncidents) {
      this.incidentCache.set(incident.id, incident);
    }

    this.incidentsTotalAvailable = mockIncidents.length;
    this.incidentsLastUpdated = new Date().toISOString();
    console.log(`  Mock historical incidents loaded: ${this.incidentCache.size} entries`);
  }

  private getMockIncidentSearch(
    query: string,
    offset: number,
    limit: number
  ): HistoricalIncidentSearchResult {
    if (query) {
      return this.searchLocalIncidents(query, offset, limit);
    }
    const cached = Array.from(this.incidentCache.values());
    return {
      incidents: cached.slice(offset, offset + limit),
      total: cached.length,
      offset,
      hasMore: offset + limit < cached.length,
    };
  }

  private getMockATCData(
    offset: number,
    limit: number
  ): ATCDatasetSearchResult {
    const mockEntries: ATCDatasetEntry[] = [
      { id: 'atc-mock-0', text: 'united four seven two cleared for takeoff runway two eight left', source: 'mock' },
      { id: 'atc-mock-1', text: 'delta one niner descend and maintain flight level two four zero', source: 'mock' },
      { id: 'atc-mock-2', text: 'american three five six turn left heading two seven zero vectors ILS runway two five left', source: 'mock' },
      { id: 'atc-mock-3', text: 'november one two three four five ident squawk seven zero zero zero', source: 'mock' },
      { id: 'atc-mock-4', text: 'southwest eight nine one contact approach one two four point three five', source: 'mock' },
      { id: 'atc-mock-5', text: 'jetblue two zero one cleared ILS runway four right maintain one seven zero knots until glideslope intercept', source: 'mock' },
      { id: 'atc-mock-6', text: 'traffic alert cessna twelve oclock two miles opposite direction altitude indicates four thousand five hundred', source: 'mock' },
      { id: 'atc-mock-7', text: 'go around go around climb and maintain three thousand fly heading one eight zero', source: 'mock' },
    ];

    return {
      entries: mockEntries.slice(offset, offset + limit),
      total: mockEntries.length,
      offset,
      hasMore: offset + limit < mockEntries.length,
    };
  }
}

// ============================================
// Singleton Export
// ============================================

export const hfDatasetsClient = new HFDatasetsClient();
