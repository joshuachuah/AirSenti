import { useEffect, useMemo, useState } from 'react';
import { Loader2, Radar } from 'lucide-react';
import { formatAltitudeFeet, formatDateTime } from '../utils';
import { useFlightTrack } from '../api/hooks';

export function FlightReplayPanel({ icao24 }: { icao24: string }) {
  const { data: track, isLoading } = useFlightTrack(icao24);
  const [replayIndex, setReplayIndex] = useState(0);

  useEffect(() => {
    if (track?.path.length) {
      setReplayIndex(track.path.length - 1);
    }
  }, [track]);

  const currentPoint = track?.path[replayIndex];
  const altitudeBounds = useMemo(() => {
    if (!track?.path.length) return null;
    const altitudes = track.path
      .map((point) => point.baro_altitude)
      .filter((altitude): altitude is number => altitude !== null);

    if (altitudes.length === 0) return null;

    return {
      min: Math.min(...altitudes),
      max: Math.max(...altitudes),
    };
  }, [track]);

  return (
    <div className="space-y-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-radar-400">
            <Radar className="h-3 w-3" /> Track Replay
          </div>
          <div className="text-sm text-gray-300">
            {track ? `${track.path.length} recorded points` : 'No live track loaded yet'}
          </div>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-radar-400" />}
      </div>

      {track && track.path.length > 0 ? (
        <>
          <input
            type="range"
            min={0}
            max={track.path.length - 1}
            value={replayIndex}
            onChange={(e) => setReplayIndex(Number(e.target.value))}
            className="w-full accent-[#00ffc8]"
          />

          {currentPoint && (
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-400">
              <div className="rounded-md border border-white/[0.04] bg-void-900/40 p-2">
                <div className="text-gray-600">Timestamp</div>
                <div>{formatDateTime(new Date(currentPoint.time * 1000))}</div>
              </div>
              <div className="rounded-md border border-white/[0.04] bg-void-900/40 p-2">
                <div className="text-gray-600">Altitude</div>
                <div>{formatAltitudeFeet(currentPoint.baro_altitude)}</div>
              </div>
              <div className="rounded-md border border-white/[0.04] bg-void-900/40 p-2">
                <div className="text-gray-600">Latitude</div>
                <div>{currentPoint.latitude?.toFixed(4) ?? 'N/A'}</div>
              </div>
              <div className="rounded-md border border-white/[0.04] bg-void-900/40 p-2">
                <div className="text-gray-600">Longitude</div>
                <div>{currentPoint.longitude?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>
          )}

          {altitudeBounds && (
            <div className="text-[11px] text-gray-500">
              Altitude band: {formatAltitudeFeet(altitudeBounds.min)} to {formatAltitudeFeet(altitudeBounds.max)}
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-gray-600">
          Track history is only available when OpenSky has recent path data for this aircraft.
        </div>
      )}
    </div>
  );
}
