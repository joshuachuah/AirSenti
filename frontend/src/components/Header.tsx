import { useState, useEffect } from 'react';
import { Bell, Settings, Wifi } from 'lucide-react';

export function Header() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-hud-border bg-void-900/80 backdrop-blur-xl z-30">
      {/* Left: breadcrumb area */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/8 border border-green-500/20">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full status-blink" />
          <span className="text-[11px] font-display font-semibold tracking-[0.12em] text-green-400 uppercase">
            Operational
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-gray-600">
          <Wifi className="w-3 h-3" />
          <span>FEED ACTIVE</span>
          <span className="text-gray-700">|</span>
          <span>OPENSKY NET</span>
        </div>
      </div>

      {/* Right: clock and actions */}
      <div className="flex items-center gap-5">
        {/* UTC Clock */}
        <div className="text-right">
          <div className="text-lg font-display font-bold text-radar-300 tabular-nums tracking-wider text-glow">
            {time.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })}
          </div>
          <div className="text-[10px] font-mono text-gray-600 tracking-widest">
            {time.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}{' '}
            UTC
          </div>
        </div>

        <div className="w-px h-6 bg-hud-border" />

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button className="btn-ghost p-2 relative">
            <Bell className="w-4 h-4" />
            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
          </button>
          <button className="btn-ghost p-2">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
