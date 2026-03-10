import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { FlightAnomaly, Incident } from '../../../shared/types';

let testDir = '';
let persistence: typeof import('./persistence');

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'airsentinel-persistence-'));
  process.env.AIRSENTINEL_DATA_DIR = testDir;
  persistence = await import('./persistence');
});

afterAll(async () => {
  delete process.env.AIRSENTINEL_DATA_DIR;
  await rm(testDir, { recursive: true, force: true });
});

describe('persistence service', () => {
  it('loads and saves incidents using the configured data directory', async () => {
    const seedIncident: Incident = {
      id: 'INC-TEST-1',
      source: 'user_report',
      title: 'Test incident',
      description: 'Seed data',
      occurred_at: new Date().toISOString(),
      reported_at: new Date().toISOString(),
      severity: 'moderate',
      categories: ['test'],
      status: 'reported',
    };

    const incidents = await persistence.loadPersistedIncidents([seedIncident]);
    expect(incidents[0]?.id).toBe('INC-TEST-1');

    const updatedIncidents = [...incidents, { ...seedIncident, id: 'INC-TEST-2', title: 'Persisted incident' }];
    await persistence.saveIncidents(updatedIncidents);

    const reloaded = await persistence.loadPersistedIncidents([]);
    expect(reloaded.map((incident) => incident.id)).toEqual(['INC-TEST-1', 'INC-TEST-2']);
  });

  it('round-trips anomalies', async () => {
    const anomaly: FlightAnomaly = {
      id: 'ANO-TEST-1',
      flight_icao24: 'abc123',
      callsign: 'DAL123',
      type: 'emergency_squawk',
      severity: 'critical',
      detected_at: new Date().toISOString(),
      location: { latitude: 40.6413, longitude: -73.7781 },
      details: { description: 'Test anomaly' },
    };

    await persistence.saveAnomalies([anomaly]);
    const reloaded = await persistence.loadPersistedAnomalies();
    expect(reloaded[0]?.id).toBe('ANO-TEST-1');
  });
});
