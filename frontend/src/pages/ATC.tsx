import { Volume2, Archive, Radio } from 'lucide-react';
import { ATCFeed } from '../components/ATCFeed';
import { useLiveATC } from '../api/hooks';
import { cn } from '../utils';

export function ATC() {
  const { data } = useLiveATC();

  const isLive = data?.is_live ?? false;
  const source = data?.source ?? 'unavailable';

  return (
    <div className="space-y-5">
      <div className="hud-panel p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-blue-400" />
            <span className="font-display font-bold text-base text-gray-200 tracking-wide">
              ATC COMMUNICATIONS
            </span>
            {source === 'archive' ? (
              <span className="flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                <Archive className="w-3 h-3" />
                ARCHIVE
              </span>
            ) : source === 'demo' ? (
              <span className="text-[9px] font-mono font-bold px-2 py-1 rounded bg-yellow-500/20 text-yellow-500">
                DEMO DATA
              </span>
            ) : null}
          </h2>
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-1.5 h-1.5 rounded-full',
              isLive ? 'bg-green-500 status-blink' : 'bg-gray-600'
            )} />
            <span className="text-xs font-mono text-gray-500">
              {isLive ? 'LIVE' : 'ARCHIVE'}
            </span>
          </div>
        </div>
        {!isLive && source === 'archive' && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20 text-[11px] font-mono text-blue-400">
            <Radio className="w-3 h-3 inline mr-1.5" />
            Showing archived ATC transcripts from the ASRS/HuggingFace dataset. Live audio streaming requires LiveATC integration.
          </div>
        )}
        <ATCFeed />
      </div>
    </div>
  );
}