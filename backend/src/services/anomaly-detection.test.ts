import { beforeEach, describe, expect, it } from 'bun:test';
import { _internal, detectAnomalies } from './anomaly-detection';
import type { Aircraft } from '../../../shared/types';

function createAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    icao24: 'abc123',
    callsign: 'DAL123',
    origin_country: 'United States',
    longitude: -73.7781,
    latitude: 40.6413,
    baro_altitude: 9500,
    geo_altitude: 9600,
    velocity: 230,
    true_track: 180,
    vertical_rate: 0,
    on_ground: false,
    squawk: null,
    spi: false,
    position_source: 0,
    last_contact: Math.floor(Date.now() / 1000),
    time_position: Math.floor(Date.now() / 1000),
    category: null,
    ...overrides,
  };
}

describe('detectAnomalies', () => {
  beforeEach(() => {
    _internal.clearHistory();
  });

  it('detects emergency squawks immediately', () => {
    const anomalies = detectAnomalies(createAircraft({ squawk: '7700' }));
    expect(anomalies.some((anomaly) => anomaly.type === 'emergency_squawk')).toBe(true);
  });

  it('detects rapid descent from a critical vertical rate', () => {
    const anomalies = detectAnomalies(createAircraft({ vertical_rate: -25 }));
    expect(anomalies.some((anomaly) => anomaly.type === 'rapid_descent')).toBe(true);
  });
});
