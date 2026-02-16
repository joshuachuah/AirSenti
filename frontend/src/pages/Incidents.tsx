import { IncidentCard } from '../components/IncidentCard';
import { useIncidents, type Incident as IncidentType } from '../api/hooks';

export function Incidents() {
  const { data: incidents, isLoading } = useIncidents({ limit: 20 });

  return (
    <div className="space-y-5">
      <div className="hud-panel p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-base text-gray-200 tracking-wide">
            AVIATION INCIDENTS
          </h2>
          <button className="btn-primary text-xs py-2">Report Incident</button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-lg loading-shimmer" />
            ))}
          </div>
        ) : !incidents || incidents.length === 0 ? (
          <div className="text-center py-16 text-gray-600 text-sm">No incidents reported</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {incidents.map((incident: IncidentType, i: number) => (
              <div
                key={incident.id}
                className="opacity-0 animate-slide-up"
                style={{ animationDelay: `${Math.min(i * 0.04, 0.5)}s` }}
              >
                <IncidentCard incident={incident} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
