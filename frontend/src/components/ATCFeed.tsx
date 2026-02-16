import { cn, formatTime } from '../utils';
import { useLiveATC } from '../api/hooks';

export function ATCFeed() {
  const { data, isLoading } = useLiveATC();

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

  return (
    <div className="space-y-2">
      {transmissions.map((tx: any, i: number) => (
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
                  : 'bg-green-500/10 text-green-400 border-green-500/20',
              )}
            >
              {tx.speaker.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono text-gray-600">{formatTime(tx.timestamp)}</span>
          </div>
          <p className="text-sm text-gray-300 font-mono leading-relaxed">{tx.text}</p>
        </div>
      ))}
      {transmissions.length === 0 && (
        <div className="text-center py-8 text-gray-600 text-sm">No ATC transmissions received</div>
      )}
    </div>
  );
}
