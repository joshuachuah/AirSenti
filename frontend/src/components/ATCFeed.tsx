import { cn, formatTime } from '../utils';
import { useLiveATC } from '../api/hooks';
import { EmptyState, ErrorState } from './StatusPrimitives';
import { Radio } from 'lucide-react';

export function ATCFeed() {
  const { data, isLoading, isError, error } = useLiveATC();

  if (isError) {
    return (
      <ErrorState
        title="ATC feed unavailable"
        message={error instanceof Error ? error.message : 'The ATC endpoint did not respond.'}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg loading-shimmer" />
        ))}
      </div>
    );
  }

  const transmissions = data?.recent_transmissions || [];
  const timestampFallback = data?.source === 'demo'
    ? 'DEMO'
    : data?.source === 'archive'
      ? 'ARCHIVE'
      : 'NO TIME';

  return (
    <div className="space-y-2">
      {transmissions.map((tx, i) => (
        <div
          key={i}
          className="p-3 rounded-lg bg-void-850/60 border border-hud-border hover:border-hud-border-active transition-colors"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={cn(
                'badge text-[10px] py-0.5 px-2',
                tx.speaker === 'atc'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : tx.speaker === 'pilot'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20',
              )}
            >
              {tx.speaker.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono text-gray-600">
              {tx.timestamp ? formatTime(tx.timestamp) : timestampFallback}
            </span>
          </div>
          <p className="text-sm text-gray-300 font-mono leading-relaxed">{tx.text}</p>
        </div>
      ))}
      {transmissions.length === 0 && (
        <EmptyState
          icon={Radio}
          title="No ATC transmissions"
          message="No live, archived, or demo transmissions are available for the selected feed."
        />
      )}
    </div>
  );
}
