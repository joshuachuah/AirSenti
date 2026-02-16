import { Plane, ChevronUp, ChevronDown } from 'lucide-react';
import {
  cn,
  formatAltitudeFeet,
  formatSpeed,
  formatHeading,
  formatVerticalRate,
  formatCoordinates,
  getSeverityBg,
  getAnomalyLabel,
  isEmergencySquawk,
  getSquawkInfo,
} from '../utils';
import type { EnrichedAircraft, FlightAnomaly } from '../api/hooks';

export function FlightCard({
  aircraft,
  anomaly,
  onClick,
  isSelected,
}: {
  aircraft: EnrichedAircraft;
  anomaly?: FlightAnomaly;
  onClick?: () => void;
  isSelected?: boolean;
}) {
  const squawkInfo = getSquawkInfo(aircraft.squawk);
  const hasEmergency = isEmergencySquawk(aircraft.squawk);
  const meta = aircraft.metadata;
  const vrate = aircraft.vertical_rate;

  return (
    <div
      onClick={onClick}
      className={cn(
        'hud-panel p-4 transition-all duration-300 group',
        onClick && 'cursor-pointer',
        'hover:border-hud-border-active',
        hasEmergency && 'border-red-500/30 shadow-glow-danger',
        anomaly && !hasEmergency && getSeverityBg(anomaly.severity),
        isSelected && 'border-radar-400/30 shadow-glow ring-1 ring-radar-400/10',
      )}
    >
      {/* Selected accent bar */}
      {isSelected && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-radar-400 shadow-glow" />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Status dot */}
          <div
            className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              hasEmergency
                ? 'bg-red-500 animate-pulse shadow-glow-danger'
                : aircraft.on_ground
                  ? 'bg-gray-500'
                  : 'bg-radar-400 shadow-glow',
            )}
          />
          <div
            className={cn(
              'p-2 rounded-lg border',
              hasEmergency
                ? 'bg-red-500/15 border-red-500/30'
                : 'bg-radar-400/8 border-radar-400/15',
            )}
          >
            <Plane
              className={cn('w-5 h-5', hasEmergency ? 'text-red-400' : 'text-radar-400')}
              style={{ transform: `rotate(${aircraft.true_track || 0}deg)` }}
            />
          </div>
          <div>
            <div className="font-display font-bold text-base tracking-wide text-gray-100">
              {aircraft.callsign || aircraft.icao24.toUpperCase()}
            </div>
            <div className="text-[11px] text-gray-500 font-mono tracking-wide">
              {aircraft.icao24.toUpperCase()}
              {meta?.registration && (
                <span className="text-gray-600"> / {meta.registration}</span>
              )}
            </div>
            {meta && (meta.model || meta.manufacturerName) && (
              <div className="text-[11px] text-radar-500 font-mono mt-0.5">
                {meta.typecode && `${meta.typecode} `}
                {meta.model || meta.manufacturerName || ''}
                {meta.operator && (
                  <span className="text-gray-600"> ({meta.operator})</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {squawkInfo && (
            <div className="badge badge-critical animate-pulse">
              {aircraft.squawk} — {squawkInfo.name}
            </div>
          )}

          {anomaly && !hasEmergency && (
            <div className={cn('badge', `badge-${anomaly.severity}`)}>
              {getAnomalyLabel(anomaly.type)}
            </div>
          )}

          {/* Vertical rate indicator */}
          {vrate !== null && vrate !== undefined && Math.abs(vrate) > 0.5 && (
            <div
              className={cn(
                'flex items-center gap-0.5 text-[10px] font-mono',
                vrate > 0 ? 'text-green-400' : 'text-orange-400',
              )}
            >
              {vrate > 0 ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <span>{formatVerticalRate(vrate)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Data grid */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'ALT', value: formatAltitudeFeet(aircraft.baro_altitude) },
          { label: 'SPD', value: formatSpeed(aircraft.velocity) },
          { label: 'HDG', value: formatHeading(aircraft.true_track) },
          { label: 'V/S', value: formatVerticalRate(aircraft.vertical_rate), color: vrate ? (vrate > 0 ? 'text-green-400' : vrate < 0 ? 'text-orange-400' : '') : '' },
          { label: 'ORIG', value: aircraft.origin_country },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div className="data-label text-[10px] mb-0.5">{label}</div>
            <div className={cn('font-mono text-sm text-gray-300 truncate tabular-nums', color)}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Coordinates */}
      {aircraft.latitude !== null && aircraft.longitude !== null && (
        <div className="mt-2.5 pt-2 border-t border-white/[0.04]">
          <div className="flex items-center justify-between">
            <div>
              <div className="data-label text-[9px] mb-0.5">POS</div>
              <div className="font-mono text-[11px] text-gray-500">
                {formatCoordinates(aircraft.latitude, aircraft.longitude)}
              </div>
            </div>
            <span className="text-[10px] font-mono text-gray-700">
              {aircraft.on_ground ? 'GND' : 'AIR'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
