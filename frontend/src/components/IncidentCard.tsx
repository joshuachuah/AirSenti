import { useState } from 'react';
import { MapPin, Database } from 'lucide-react';
import { cn, formatRelativeTime } from '../utils';
import { useHistoricalIncidentSearch, type Incident, type HistoricalIncident } from '../api/hooks';

export function IncidentCard({ incident }: { incident: Incident }) {
  const [showSimilar, setShowSimilar] = useState(false);
  const { data: similar } = useHistoricalIncidentSearch(incident.title, {
    limit: 3,
    enabled: showSimilar,
  });

  return (
    <div className="hud-panel p-4 hover:border-hud-border-active transition-all duration-300">
      <div className="flex items-start justify-between mb-2">
        <span className={cn('badge', `badge-${incident.severity}`)}>
          {incident.severity}
        </span>
        <span className="text-[10px] font-mono text-gray-600">
          {formatRelativeTime(incident.occurred_at)}
        </span>
      </div>

      <h4 className="font-sans font-semibold text-sm text-gray-200 mb-1">{incident.title}</h4>
      <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">{incident.description}</p>

      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-gray-600">
          <MapPin className="w-3 h-3" />
          <span className="font-mono">{incident.location?.airport_icao || 'N/A'}</span>
        </div>
        <span className="badge badge-info text-[10px] py-0.5 px-2">
          {incident.source}
        </span>
      </div>

      <button
        onClick={() => setShowSimilar(!showSimilar)}
        className="mt-3 flex items-center gap-1.5 text-[11px] font-display font-medium text-radar-500 hover:text-radar-400 transition-colors"
      >
        <Database className="w-3 h-3" />
        {showSimilar ? 'Hide' : 'Find'} Similar Reports
      </button>

      {showSimilar && similar?.incidents && similar.incidents.length > 0 && (
        <div className="mt-2 space-y-1.5 border-t border-hud-border pt-2">
          {similar.incidents.map((hi: HistoricalIncident) => (
            <div key={hi.id} className="text-[11px] text-gray-500 p-2 rounded-md bg-void-850/50">
              <span className="text-gray-400 font-mono">{hi.date || 'N/A'}</span>
              {hi.aircraftMakeModel && <span className="text-radar-500"> {hi.aircraftMakeModel}</span>}
              <span className="text-gray-600"> — {hi.synopsis || hi.narrative.slice(0, 100)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
