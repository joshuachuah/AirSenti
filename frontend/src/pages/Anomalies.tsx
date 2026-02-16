import { cn } from '../utils';
import { AnomalyCard } from '../components/AnomalyCard';
import { useAnomalies, useFlights, type FlightAnomaly } from '../api/hooks';

export function Anomalies() {
  const { data: anomalies } = useAnomalies({ limit: 30 });
  const { data: flightsData } = useFlights({ limit: 20 });
  const flightAnomalies = flightsData?.anomalies || [];
  const allAnomalies = anomalies && anomalies.length > 0 ? anomalies : flightAnomalies;

  return (
    <div className="space-y-5">
      <div className="hud-panel p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-base text-gray-200 tracking-wide">
            DETECTED ANOMALIES
          </h2>
          <div className="flex gap-1.5">
            {(['critical', 'high', 'medium', 'low'] as const).map((severity) => (
              <button
                key={severity}
                className={cn(
                  'badge text-[10px] py-0.5 px-2.5 cursor-pointer hover:opacity-80 transition-opacity',
                  `badge-${severity}`,
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
