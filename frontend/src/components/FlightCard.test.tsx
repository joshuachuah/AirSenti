import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlightCard } from './FlightCard';
import type { EnrichedAircraft, FlightAnomaly } from '../api/hooks';

const aircraft: EnrichedAircraft = {
  icao24: 'abc123',
  callsign: 'DAL123',
  origin_country: 'United States',
  longitude: -73.7781,
  latitude: 40.6413,
  baro_altitude: 9100,
  geo_altitude: 9200,
  velocity: 220,
  true_track: 180,
  vertical_rate: -3,
  on_ground: false,
  squawk: null,
  spi: false,
  position_source: 0,
  last_contact: Math.floor(Date.now() / 1000),
  time_position: Math.floor(Date.now() / 1000),
  category: null,
  metadata: {
    icao24: 'abc123',
    registration: 'N12345',
    manufacturerIcao: null,
    manufacturerName: 'Boeing',
    model: '737-800',
    typecode: 'B738',
    serialNumber: null,
    icaoAircraftType: 'L2J',
    operator: 'Delta Air Lines',
    operatorCallsign: null,
    operatorIcao: null,
    owner: null,
    categoryDescription: null,
    built: null,
    firstFlightDate: null,
    engines: 'CFM56-7B',
  },
};

const anomaly: FlightAnomaly = {
  id: 'ANO-2',
  flight_icao24: 'abc123',
  callsign: 'DAL123',
  type: 'rapid_descent',
  severity: 'high',
  detected_at: new Date().toISOString(),
  location: { latitude: 40.6413, longitude: -73.7781 },
  details: { description: 'Rapid descent detected' },
};

describe('FlightCard', () => {
  it('renders core flight metadata', () => {
    const markup = renderToStaticMarkup(<FlightCard aircraft={aircraft} anomaly={anomaly} />);

    expect(markup).toContain('DAL123');
    expect(markup).toContain('N12345');
    expect(markup).toContain('Rapid Descent');
  });
});
