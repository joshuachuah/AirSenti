import { cn, formatNumber, isEmergencySquawk } from '../utils';
import { useFlights } from '../api/hooks';

export function RadarMap() {
  const { data: flightsData } = useFlights({ limit: 50 });
  const aircraft = flightsData?.aircraft || [];

  return (
    <div className="relative w-full h-full min-h-[480px] rounded-xl overflow-hidden bg-void-900 border border-hud-border">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-60" />

      {/* Atmospheric gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0, 255, 200, 0.02) 0%, transparent 70%)',
        }}
      />

      {/* World map silhouette */}
      <div className="absolute inset-0 opacity-15">
        <svg viewBox="0 0 1000 500" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="mapFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00ffc8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          {/* North America / Europe simplified */}
          <path
            d="M150,150 Q200,100 300,120 T450,130 Q500,140 550,120 T650,140 L700,160 Q750,180 800,150 L850,170 L800,220 Q750,250 700,240 L650,260 Q600,280 550,260 L500,280 Q450,300 400,280 L350,300 Q300,320 250,300 L200,280 Q150,260 150,220 Z"
            fill="url(#mapFill)"
            stroke="rgba(0,255,200,0.12)"
            strokeWidth="0.5"
          />
          {/* South America */}
          <path
            d="M100,250 Q150,230 200,250 T300,260 Q350,280 400,320 L350,380 Q300,400 250,380 L200,350 Q150,320 100,340 L80,300 Q90,270 100,250 Z"
            fill="url(#mapFill)"
            stroke="rgba(0,255,200,0.12)"
            strokeWidth="0.5"
          />
          {/* Asia / Australia */}
          <path
            d="M700,250 Q750,230 800,250 T900,280 L920,350 Q900,400 850,380 L800,350 Q750,320 700,340 L680,300 Q690,270 700,250 Z"
            fill="url(#mapFill)"
            stroke="rgba(0,255,200,0.12)"
            strokeWidth="0.5"
          />
        </svg>
      </div>

      {/* Radar sweep */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-72 h-72">
          {/* Concentric rings */}
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute rounded-full border"
              style={{
                borderColor: `rgba(0, 255, 200, ${0.06 - i * 0.01})`,
                width: `${i * 25}%`,
                height: `${i * 25}%`,
                top: `${50 - i * 12.5}%`,
                left: `${50 - i * 12.5}%`,
              }}
            />
          ))}

          {/* Sweep line */}
          <div className="absolute inset-0 animate-sweep origin-center">
            <div
              className="absolute top-1/2 left-1/2 w-1/2 h-[1px] origin-left"
              style={{
                background: 'linear-gradient(90deg, rgba(0,255,200,0.6), transparent)',
                boxShadow: '0 0 8px rgba(0,255,200,0.3)',
              }}
            />
          </div>

          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-radar-400 rounded-full shadow-glow" />
        </div>
      </div>

      {/* Aircraft dots */}
      <div className="absolute inset-0">
        {aircraft.slice(0, 30).map((ac) => {
          if (!ac.latitude || !ac.longitude) return null;
          const x = ((ac.longitude + 180) / 360) * 100;
          const y = ((90 - ac.latitude) / 180) * 100;

          return (
            <div
              key={ac.icao24}
              className="absolute group cursor-pointer"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div
                className={cn(
                  'w-[6px] h-[6px] rounded-full transition-transform duration-200 group-hover:scale-[2]',
                  isEmergencySquawk(ac.squawk)
                    ? 'bg-red-500 shadow-glow-danger animate-pulse'
                    : ac.on_ground
                      ? 'bg-gray-600'
                      : 'bg-radar-400 shadow-glow',
                )}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-void-900/95 border border-hud-border rounded-md text-[11px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-panel">
                <div className="text-radar-400 font-semibold">{ac.callsign || ac.icao24.toUpperCase()}</div>
                {ac.baro_altitude && (
                  <div className="text-gray-500">{Math.round(ac.baro_altitude * 3.281).toLocaleString()} ft</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 p-3 rounded-lg bg-void-900/90 border border-hud-border text-[10px] space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-[6px] h-[6px] bg-radar-400 rounded-full shadow-glow" />
          <span className="text-gray-500 font-mono">AIRBORNE</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[6px] h-[6px] bg-gray-600 rounded-full" />
          <span className="text-gray-500 font-mono">GROUND</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[6px] h-[6px] bg-red-500 rounded-full animate-pulse" />
          <span className="text-gray-500 font-mono">EMERGENCY</span>
        </div>
      </div>

      {/* Tracking count */}
      <div className="absolute top-3 right-3 p-3 rounded-lg bg-void-900/90 border border-hud-border text-right">
        <div className="data-label text-[9px] mb-0.5">TRACKING</div>
        <div className="text-xl font-display font-bold text-radar-300 text-glow tabular-nums">
          {formatNumber(aircraft.length)}
        </div>
        <div className="text-[9px] font-mono text-gray-600">AIRCRAFT</div>
      </div>
    </div>
  );
}
