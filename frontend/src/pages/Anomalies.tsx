import { useMemo, useState } from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import { cn } from '../utils';
import { AnomalyCard } from '../components/AnomalyCard';
import { useAnomalies, useFlights, type FlightAnomaly } from '../api/hooks';
import { DataSourceBadge, EmptyState, ErrorState } from '../components/StatusPrimitives';

const severityOptions = ['all', 'critical', 'high', 'medium', 'low'] as const;
type SeverityFilter = (typeof severityOptions)[number];

export function Anomalies() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const { data: anomalies, isLoading, isError, error } = useAnomalies({
    limit: 30,
    severity: severityFilter === 'all' ? undefined : severityFilter,
  });
  const { data: flightsData, isError: flightsError } = useFlights({ limit: 20 });
  const flightAnomalies = flightsData?.anomalies || [];
  const allAnomalies = useMemo(() => {
    const source = anomalies && anomalies.length > 0 ? anomalies : flightAnomalies;
    return severityFilter === 'all'
      ? source
      : source.filter((anomaly) => anomaly.severity === severityFilter);
  }, [anomalies, flightAnomalies, severityFilter]);

  return (
    <div className="space-y-5">
      <div className="hud-panel p-5">
        <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
          <h2 className="font-display font-bold text-base text-gray-200 tracking-wide">
            DETECTED ANOMALIES
          </h2>
          <DataSourceBadge source={flightsError ? 'unavailable' : 'live'} label="DETECTION ENGINE" />
          <div className="flex gap-1.5 flex-wrap">
            {severityOptions.map((severity) => (
              <button
                key={severity}
                onClick={() => setSeverityFilter(severity)}
                className={cn(
                  'badge text-[10px] py-0.5 px-2.5 cursor-pointer transition-all duration-200',
                  severity === 'all'
                    ? severityFilter === severity
                      ? 'badge-info'
                      : 'border-white/10 text-gray-500 hover:text-radar-400'
                    : `badge-${severity}`,
                  severityFilter !== severity && severity !== 'all' && 'opacity-60 hover:opacity-100'
                )}
              >
                {severity}
              </button>
            ))}
          </div>
        </div>

        {isError ? (
          <ErrorState
            title="Anomalies unavailable"
            message={error instanceof Error ? error.message : 'The anomaly detection endpoint did not respond.'}
          />
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-lg loading-shimmer" />
            ))}
          </div>
        ) : allAnomalies.length === 0 ? (
          <EmptyState
            icon={severityFilter === 'all' ? Shield : AlertTriangle}
            title="No anomalies detected"
            message={
              severityFilter === 'all'
                ? 'No active flight anomalies are available in the current feed.'
                : `No ${severityFilter} anomalies match this filter.`
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allAnomalies.map((anomaly: FlightAnomaly, i: number) => (
              <div
                key={anomaly.id}
                className="opacity-0 animate-slide-up"
                style={{ animationDelay: `${Math.min(i * 0.04, 0.5)}s` }}
              >
                <AnomalyCard anomaly={anomaly} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
