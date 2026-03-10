import { useMemo, useState } from 'react';
import { cn } from '../utils';
import { AnomalyCard } from '../components/AnomalyCard';
import { useAnomalies, useFlights, type FlightAnomaly } from '../api/hooks';

const severityOptions = ['all', 'critical', 'high', 'medium', 'low'] as const;
type SeverityFilter = (typeof severityOptions)[number];

export function Anomalies() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const { data: anomalies } = useAnomalies({
    limit: 30,
    severity: severityFilter === 'all' ? undefined : severityFilter,
  });
  const { data: flightsData } = useFlights({ limit: 20 });
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

        {allAnomalies.length === 0 ? (
          <div className="text-center py-16 text-gray-600 text-sm">No anomalies detected</div>
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
