import { AlertTriangle, ChevronRight } from 'lucide-react';
import { cn, getSeverityColor, getSeverityBg, getAnomalyLabel, formatRelativeTime } from '../utils';
import type { FlightAnomaly } from '../api/hooks';

export function AnomalyCard({ anomaly }: { anomaly: FlightAnomaly }) {
  return (
    <div
      className={cn(
        'hud-panel p-4 transition-all duration-300 group hover:border-hud-border-active',
        getSeverityBg(anomaly.severity),
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn('w-4 h-4', getSeverityColor(anomaly.severity))} />
          <span className={cn('text-sm font-display font-semibold', getSeverityColor(anomaly.severity))}>
            {getAnomalyLabel(anomaly.type)}
          </span>
        </div>
        <span className="text-[10px] font-mono text-gray-600">{formatRelativeTime(anomaly.detected_at)}</span>
      </div>

      <p className="text-sm text-gray-400 mb-3 leading-relaxed">{anomaly.details.description}</p>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-gray-500 tracking-wide">
          {anomaly.callsign || anomaly.flight_icao24}
        </span>
        <button className="flex items-center gap-1 text-[11px] font-display font-medium text-radar-500 hover:text-radar-400 transition-colors group-hover:translate-x-0.5 duration-200">
          Analyze
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
