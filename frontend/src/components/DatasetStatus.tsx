import { Database } from 'lucide-react';
import { cn, formatCompact } from '../utils';
import { useDatasetStatus } from '../api/hooks';
import { DataSourceBadge, ErrorState, FreshnessStamp } from './StatusPrimitives';

export function DatasetStatus() {
  const { data: status, isLoading, isError, error } = useDatasetStatus();

  if (isError) {
    return (
      <ErrorState
        title="Dataset status unavailable"
        message={error instanceof Error ? error.message : 'Dataset readiness could not be loaded.'}
      />
    );
  }

  if (isLoading || !status) {
    return (
      <div className="hud-panel p-5">
        <div className="h-24 loading-shimmer rounded-lg" />
      </div>
    );
  }

  const datasets = [
    {
      label: 'Aircraft Metadata',
      count: status.aircraftMetadata.count,
      loaded: status.aircraftMetadata.loaded,
      color: 'text-radar-400',
      sub: 'aircraft records',
      source: status.aircraftMetadata.loaded ? 'archive' : 'unavailable',
      updated: status.aircraftMetadata.lastUpdated,
    },
    {
      label: 'ASRS Safety Reports',
      count: status.historicalIncidents.seedCount,
      loaded: status.historicalIncidents.loaded,
      color: 'text-amber-400',
      sub: `of ${formatCompact(status.historicalIncidents.totalAvailable)} total`,
      source: status.historicalIncidents.loaded ? 'asrs' : 'demo',
      updated: status.historicalIncidents.lastUpdated,
    },
    {
      label: 'ATC Transcripts',
      count: status.atcTranscripts.totalEntries,
      loaded: status.atcTranscripts.available,
      color: 'text-blue-400',
      sub: 'entries available',
      source: status.atcTranscripts.available ? 'archive' : 'unavailable',
      updated: null,
    },
  ] as const;

  return (
    <div className="hud-panel p-5">
      <h3 className="flex items-center gap-2 mb-4">
        <Database className="w-4 h-4 text-radar-400" />
        <span className="font-display font-semibold text-sm text-gray-200 tracking-wide">
          HuggingFace Datasets
        </span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {datasets.map((ds) => (
          <div
            key={ds.label}
            className="p-3 rounded-lg bg-void-850/50 border border-hud-border"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-sans font-medium text-gray-400">{ds.label}</span>
              <DataSourceBadge source={ds.source} />
            </div>
            <div className={cn('text-xl font-display font-bold', ds.color)}>
              {formatCompact(ds.count)}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-mono text-gray-600">
              <span>{ds.sub}</span>
              <FreshnessStamp timestamp={ds.updated} fallback={ds.loaded ? 'Archive cache' : 'Unavailable'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
