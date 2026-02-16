import { Volume2 } from 'lucide-react';
import { ATCFeed } from '../components/ATCFeed';

export function ATC() {
  return (
    <div className="space-y-5">
      <div className="hud-panel p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-blue-400" />
            <span className="font-display font-bold text-base text-gray-200 tracking-wide">
              LIVE ATC COMMUNICATIONS
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full status-blink" />
            <span className="text-xs font-mono text-gray-500">KLAX TOWER</span>
          </div>
        </div>
        <ATCFeed />
      </div>
    </div>
  );
}
