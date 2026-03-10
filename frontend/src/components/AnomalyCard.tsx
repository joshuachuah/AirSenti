import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight, Sparkles } from 'lucide-react';
import { cn, getSeverityColor, getSeverityBg, getAnomalyLabel, formatRelativeTime } from '../utils';
import { useAnalyzeAnomaly, type FlightAnomaly } from '../api/hooks';

export function AnomalyCard({ anomaly }: { anomaly: FlightAnomaly }) {
  const analyzeAnomaly = useAnalyzeAnomaly();
  const [analysis, setAnalysis] = useState(anomaly.ai_analysis || '');

  useEffect(() => {
    setAnalysis(anomaly.ai_analysis || '');
  }, [anomaly.ai_analysis]);

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

      {analysis && (
        <div className="mb-3 rounded-lg border border-radar-400/20 bg-radar-400/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-display uppercase tracking-[0.16em] text-radar-400">
            <Sparkles className="h-3 w-3" /> AI Analysis
          </div>
          <p className="text-[12px] leading-relaxed text-gray-300">{analysis}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-mono text-gray-500 tracking-wide">
          {anomaly.callsign || anomaly.flight_icao24}
        </span>
        <button
          onClick={() => {
            analyzeAnomaly.mutate(anomaly.id, {
              onSuccess: (updated) => setAnalysis(updated.ai_analysis || ''),
            });
          }}
          disabled={analyzeAnomaly.isPending}
          className="flex items-center gap-1 text-[11px] font-display font-medium text-radar-500 hover:text-radar-400 transition-colors group-hover:translate-x-0.5 duration-200 disabled:text-gray-600 disabled:cursor-not-allowed"
        >
          {analyzeAnomaly.isPending ? 'Analyzing' : analysis ? 'Refresh analysis' : 'Analyze'}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
