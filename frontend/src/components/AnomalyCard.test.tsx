import { describe, expect, it } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnomalyCard } from './AnomalyCard';
import type { FlightAnomaly } from '../api/hooks';

const anomaly: FlightAnomaly = {
  id: 'ANO-1',
  flight_icao24: 'abc123',
  callsign: 'DAL123',
  type: 'rapid_descent',
  severity: 'high',
  detected_at: new Date().toISOString(),
  location: { latitude: 40.6413, longitude: -73.7781 },
  details: { description: 'Rapid descent detected' },
};

describe('AnomalyCard', () => {
  it('renders the anomaly label and action', () => {
    const queryClient = new QueryClient();
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <AnomalyCard anomaly={anomaly} />
      </QueryClientProvider>
    );

    expect(markup).toContain('Rapid Descent');
    expect(markup).toContain('Analyze');
  });
});
