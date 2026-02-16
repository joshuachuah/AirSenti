import { useState, useEffect, useMemo } from 'react';
import {
  Plane,
  AlertTriangle,
  FileText,
  Radio,
  Shield,
  Activity,
  Eye,
  Crosshair,
  ArrowUpRight,
  ChevronRight,
  MapPin,
  Zap,
  TrendingUp,
  BarChart3,
  Database,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
} from 'recharts';
import {
  useDashboardStats,
  useFlights,
  useAnomalies,
  useIncidents,
  useDatasetStatus,
  type FlightAnomaly,
  type Incident,
  type EnrichedAircraft,
} from '../api/hooks';
import {
  cn,
  formatCompact,
  formatNumber,
  formatRelativeTime,
  getSeverityColor,
  getAnomalyLabel,
  isEmergencySquawk,
  formatAltitudeFeet,
  formatSpeed,
} from '../utils';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ThreatGauge({ level }: { level: number }) {
  // level 0-4: NOMINAL, GUARDED, ELEVATED, HIGH, SEVERE
  const labels = ['NOMINAL', 'GUARDED', 'ELEVATED', 'HIGH', 'SEVERE'];
  const colors = ['#00ffc8', '#22c55e', '#eab308', '#f97316', '#ef4444'];
  const glows = [
    'rgba(0,255,200,0.3)',
    'rgba(34,197,94,0.3)',
    'rgba(234,179,8,0.3)',
    'rgba(249,115,22,0.3)',
    'rgba(239,68,68,0.3)',
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-28 h-28">
        {/* Outer ring */}
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50" cy="50" r="44"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="6"
          />
          <circle
            cx="50" cy="50" r="44"
            fill="none"
            stroke={colors[level]}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(level + 1) * 55} 276`}
            style={{
              filter: `drop-shadow(0 0 8px ${glows[level]})`,
              transition: 'stroke-dasharray 1s ease, stroke 0.5s ease',
            }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-2xl font-display font-bold tabular-nums"
            style={{ color: colors[level], textShadow: `0 0 20px ${glows[level]}` }}
          >
            {level}
          </span>
          <span className="text-[8px] font-mono tracking-[0.2em] text-gray-500 mt-0.5">LEVEL</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-500"
            style={{
              width: i <= level ? 14 : 8,
              background: i <= level ? colors[i] : 'rgba(255,255,255,0.06)',
              boxShadow: i <= level ? `0 0 6px ${glows[i]}` : 'none',
            }}
          />
        ))}
      </div>
      <span
        className="text-[11px] font-display font-bold tracking-[0.25em]"
        style={{ color: colors[level] }}
      >
        {labels[level]}
      </span>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delay,
}: {
  icon: typeof Plane;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delay: number;
}) {
  const colorVars: Record<string, { text: string; bg: string; fill: string; stroke: string }> = {
    radar: {
      text: 'text-radar-400',
      bg: 'bg-radar-400/8',
      fill: 'rgba(0,255,200,0.08)',
      stroke: 'rgba(0,255,200,0.5)',
    },
    amber: {
      text: 'text-amber-400',
      bg: 'bg-amber-400/8',
      fill: 'rgba(245,158,11,0.08)',
      stroke: 'rgba(245,158,11,0.5)',
    },
    red: {
      text: 'text-red-400',
      bg: 'bg-red-400/8',
      fill: 'rgba(239,68,68,0.08)',
      stroke: 'rgba(239,68,68,0.5)',
    },
    blue: {
      text: 'text-blue-400',
      bg: 'bg-blue-400/8',
      fill: 'rgba(59,130,246,0.08)',
      stroke: 'rgba(59,130,246,0.5)',
    },
  };
  const c = colorVars[color] || colorVars.radar;

  return (
    <div
      className="stat-card group opacity-0 animate-slide-up relative overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >

      <div className="relative z-10">
        <div className="flex items-center gap-2.5 mb-4">
          <div className={cn('p-2 rounded-lg border border-white/[0.04]', c.bg)}>
            <Icon className={cn('w-4 h-4', c.text)} />
          </div>
          <span className="data-label">{label}</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <span
              className={cn('text-3xl font-display font-bold tracking-tight', c.text)}
              style={{ textShadow: `0 0 25px ${c.fill}` }}
            >
              {typeof value === 'number' ? formatCompact(value) : value}
            </span>
            {sub && (
              <span className="block text-[10px] font-mono text-gray-600 mt-1">{sub}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveFeedItem({
  icon: Icon,
  iconColor,
  text,
  time,
  highlight,
}: {
  icon: typeof Activity;
  iconColor: string;
  text: string;
  time: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200',
        highlight ? 'bg-amber-500/5 border border-amber-500/10' : 'hover:bg-white/[0.02]',
      )}
    >
      <div className="mt-0.5 flex-shrink-0">
        <Icon className={cn('w-3.5 h-3.5', iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-gray-300 leading-relaxed">{text}</p>
        <span className="text-[10px] font-mono text-gray-600">{time}</span>
      </div>
    </div>
  );
}

function AircraftTypeBar({
  data,
}: {
  data: { type: string; count: number; pct: number }[];
}) {
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.type}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono text-gray-400">{d.type}</span>
            <span className="text-[11px] font-mono text-gray-500">{d.count}</span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-radar-400/50 transition-all duration-1000"
              style={{ width: `${d.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Overview Component
// ---------------------------------------------------------------------------
export function Overview() {
  const { data: stats } = useDashboardStats();
  const { data: flightsData } = useFlights({ limit: 50 });
  const { data: anomalies, isLoading: anomaliesLoading } = useAnomalies({ limit: 10 });
  const { data: incidents, isLoading: incidentsLoading } = useIncidents({ limit: 10 });
  const { data: datasetStatus } = useDatasetStatus();

  const aircraft = flightsData?.aircraft || [];
  const flightAnomalies = flightsData?.anomalies || [];
  const allAnomalies = anomalies && anomalies.length > 0 ? anomalies : flightAnomalies;

  // Compute derived stats
  const airborne = aircraft.filter((a) => !a.on_ground).length;
  const grounded = aircraft.filter((a) => a.on_ground).length;
  const emergencies = aircraft.filter((a) => isEmergencySquawk(a.squawk)).length;
  const avgAlt = useMemo(() => {
    const alts = aircraft.filter((a) => a.baro_altitude && !a.on_ground).map((a) => a.baro_altitude!);
    return alts.length ? Math.round((alts.reduce((s, v) => s + v, 0) / alts.length) * 3.281) : 0;
  }, [aircraft]);
  const avgSpeed = useMemo(() => {
    const speeds = aircraft.filter((a) => a.velocity && !a.on_ground).map((a) => a.velocity!);
    return speeds.length ? Math.round((speeds.reduce((s, v) => s + v, 0) / speeds.length) * 1.944) : 0;
  }, [aircraft]);

  // Country distribution
  const countryDist = useMemo(() => {
    const map: Record<string, number> = {};
    aircraft.forEach((a) => {
      map[a.origin_country] = (map[a.origin_country] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({
        type,
        count,
        pct: aircraft.length ? Math.round((count / aircraft.length) * 100) : 0,
      }));
  }, [aircraft]);

  // Altitude distribution for chart
  const altDistribution = useMemo(() => {
    const buckets = [
      { range: '0-5K', min: 0, max: 1524, count: 0 },
      { range: '5-15K', min: 1524, max: 4572, count: 0 },
      { range: '15-25K', min: 4572, max: 7620, count: 0 },
      { range: '25-35K', min: 7620, max: 10668, count: 0 },
      { range: '35K+', min: 10668, max: 99999, count: 0 },
    ];
    aircraft.forEach((a) => {
      if (a.baro_altitude && !a.on_ground) {
        const b = buckets.find((b) => a.baro_altitude! >= b.min && a.baro_altitude! < b.max);
        if (b) b.count++;
      }
    });
    return buckets.map((b) => ({ name: b.range, flights: b.count }));
  }, [aircraft]);

  // Threat level based on anomalies
  const threatLevel = useMemo(() => {
    if (emergencies > 0) return 4;
    const criticals = allAnomalies.filter((a) => a.severity === 'critical').length;
    const highs = allAnomalies.filter((a) => a.severity === 'high').length;
    if (criticals > 0) return 3;
    if (highs > 2) return 2;
    if (allAnomalies.length > 3) return 1;
    return 0;
  }, [allAnomalies, emergencies]);

  // Live feed items built from real data
  const feedItems = useMemo(() => {
    const items: {
      icon: typeof Activity;
      iconColor: string;
      text: string;
      time: string;
      highlight?: boolean;
    }[] = [];

    // Add anomalies
    allAnomalies.slice(0, 3).forEach((a) => {
      items.push({
        icon: AlertTriangle,
        iconColor: getSeverityColor(a.severity),
        text: `${getAnomalyLabel(a.type)} detected — ${a.callsign || a.flight_icao24}`,
        time: formatRelativeTime(a.detected_at),
        highlight: a.severity === 'critical' || a.severity === 'high',
      });
    });

    // Add incidents
    if (incidents) {
      incidents.slice(0, 2).forEach((inc) => {
        items.push({
          icon: Shield,
          iconColor: 'text-red-400',
          text: inc.title,
          time: formatRelativeTime(inc.occurred_at),
          highlight: inc.severity === 'critical',
        });
      });
    }

    // Add generic tracking event
    if (aircraft.length > 0) {
      items.push({
        icon: Eye,
        iconColor: 'text-radar-400',
        text: `Tracking ${airborne} airborne / ${grounded} on ground across ${countryDist.length}+ regions`,
        time: 'Now',
      });
    }

    return items.slice(0, 6);
  }, [allAnomalies, incidents, aircraft, airborne, grounded, countryDist.length]);

  // Animated counter
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    const target = airborne;
    if (target === 0) return;
    let current = 0;
    const step = Math.max(1, Math.floor(target / 30));
    const interval = setInterval(() => {
      current = Math.min(current + step, target);
      setVisibleCount(current);
      if (current >= target) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [airborne]);

  return (
    <div className="space-y-5">
      {/* ────────────────────── TOP HERO STRIP ────────────────────── */}
      <div className="hud-panel p-0 overflow-hidden opacity-0 animate-slide-up stagger-1">
        <div className="relative">
          {/* Decorative grid */}
          <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 60% 100% at 0% 50%, rgba(0,255,200,0.03) 0%, transparent 70%), radial-gradient(ellipse 40% 100% at 100% 50%, rgba(59,130,246,0.02) 0%, transparent 70%)',
            }}
          />

          <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-6 p-6 lg:p-8">
            {/* Left – primary metric */}
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-4">
                <Crosshair className="w-4 h-4 text-radar-400" />
                <span className="data-label">AIRSPACE OVERVIEW</span>
              </div>
              <div className="flex items-end gap-3">
                <span
                  className="text-6xl lg:text-7xl font-display font-bold text-radar-300 tabular-nums tracking-tight"
                  style={{ textShadow: '0 0 40px rgba(0,255,200,0.2), 0 0 80px rgba(0,255,200,0.08)' }}
                >
                  {formatNumber(visibleCount)}
                </span>
                <div className="pb-2">
                  <span className="block text-sm font-display font-semibold text-gray-300 tracking-wide">
                    AIRBORNE
                  </span>
                  <span className="text-[11px] font-mono text-gray-600">
                    of {formatNumber(aircraft.length)} tracked
                  </span>
                </div>
              </div>
              {/* Sub-metrics */}
              <div className="flex items-center gap-5 mt-5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                  <span className="text-[11px] font-mono text-gray-500">
                    {formatNumber(grounded)} ground
                  </span>
                </div>
                <div className="w-px h-3 bg-hud-border" />
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-3 h-3 text-radar-500" />
                  <span className="text-[11px] font-mono text-gray-500">
                    AVG {formatNumber(avgAlt)} ft
                  </span>
                </div>
                <div className="w-px h-3 bg-hud-border" />
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-blue-500" />
                  <span className="text-[11px] font-mono text-gray-500">
                    AVG {formatNumber(avgSpeed)} kts
                  </span>
                </div>
                {emergencies > 0 && (
                  <>
                    <div className="w-px h-3 bg-hud-border" />
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[11px] font-mono text-red-400">
                        {emergencies} EMERGENCY
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Center divider */}
            <div className="hidden lg:block w-px self-stretch bg-gradient-to-b from-transparent via-hud-border to-transparent" />

            {/* Right – threat gauge */}
            <div className="flex justify-center lg:justify-end">
              <ThreatGauge level={threatLevel} />
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────── STAT TILES ────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricTile
          icon={Plane}
          label="Flights Tracked"
          value={stats?.flights_tracked || aircraft.length}
          sub="15s refresh"
          color="radar"
          delay={80}
        />
        <MetricTile
          icon={AlertTriangle}
          label="Active Anomalies"
          value={stats?.active_anomalies || allAnomalies.length}
          sub={allAnomalies.length > 0 ? `${allAnomalies.filter((a) => a.severity === 'high' || a.severity === 'critical').length} high+` : 'clear'}
          color="amber"
          delay={130}
        />
        <MetricTile
          icon={FileText}
          label="Incidents Today"
          value={stats?.incidents_today || 0}
          sub={incidents?.length ? `${incidents.length} total` : 'none'}
          color="red"
          delay={180}
        />
        <MetricTile
          icon={Radio}
          label="ATC Processed"
          value={stats?.atc_communications_processed || 0}
          sub="transcripts"
          color="blue"
          delay={230}
        />
      </div>

      {/* ────────────────────── MAIN GRID ────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* ─── Radar Map ─── */}
        <div className="xl:col-span-8 opacity-0 animate-slide-up" style={{ animationDelay: '280ms' }}>
          <div className="hud-panel">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-hud-border">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-radar-400 animate-pulse shadow-glow" />
                <h2 className="font-display font-bold text-sm text-gray-200 tracking-[0.1em]">
                  LIVE TRACKING
                </h2>
                <span className="text-[10px] font-mono text-gray-600 bg-white/[0.03] px-2 py-0.5 rounded">
                  {formatNumber(aircraft.length)} targets
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-600">
                  <div className="w-[5px] h-[5px] rounded-full bg-radar-400" />
                  <span>AIR</span>
                  <div className="w-[5px] h-[5px] rounded-full bg-gray-600 ml-2" />
                  <span>GND</span>
                  <div className="w-[5px] h-[5px] rounded-full bg-red-500 animate-pulse ml-2" />
                  <span>EMG</span>
                </div>
              </div>
            </div>
            <div className="p-3">
              <RadarMapInline aircraft={aircraft} />
            </div>
          </div>
        </div>

        {/* ─── Right Column: Activity Feed + Alt Chart ─── */}
        <div className="xl:col-span-4 space-y-5">
          {/* Activity Feed */}
          <div
            className="hud-panel opacity-0 animate-slide-up"
            style={{ animationDelay: '330ms' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <h3 className="font-display font-semibold text-sm text-gray-200 tracking-wide">
                  LIVE FEED
                </h3>
              </div>
              <span className="text-[10px] font-mono text-gray-600">{feedItems.length} events</span>
            </div>
            <div className="p-2 space-y-0.5 max-h-[320px] overflow-y-auto">
              {feedItems.length > 0 ? (
                feedItems.map((item, i) => <LiveFeedItem key={i} {...item} />)
              ) : (
                <div className="text-center py-8 text-gray-600 text-sm">No activity</div>
              )}
            </div>
          </div>

          {/* Altitude Distribution */}
          <div
            className="hud-panel opacity-0 animate-slide-up"
            style={{ animationDelay: '380ms' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                <h3 className="font-display font-semibold text-sm text-gray-200 tracking-wide">
                  ALT DISTRIBUTION
                </h3>
              </div>
              <span className="text-[10px] font-mono text-gray-600">ft MSL</span>
            </div>
            <div className="p-4">
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={altDistribution} barCategoryGap="20%">
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'Fira Code' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(6,12,24,0.95)',
                        border: '1px solid rgba(0,255,200,0.1)',
                        borderRadius: 8,
                        fontSize: 11,
                        fontFamily: 'Fira Code',
                        color: '#9ca3af',
                      }}
                      cursor={false}
                    />
                    <Bar
                      dataKey="flights"
                      fill="rgba(0,255,200,0.35)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────── BOTTOM ROW ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Anomalies panel */}
        <div className="hud-panel opacity-0 animate-slide-up" style={{ animationDelay: '430ms' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <h3 className="font-display font-semibold text-sm text-gray-200 tracking-wide">
                ANOMALIES
              </h3>
            </div>
            <span className="text-[10px] font-mono text-gray-600">
              {allAnomalies.length} total
            </span>
          </div>
          <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
            {anomaliesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-lg loading-shimmer" />
                ))}
              </div>
            ) : allAnomalies.length > 0 ? (
              allAnomalies.slice(0, 5).map((anomaly: FlightAnomaly) => (
                <AnomalyRow key={anomaly.id} anomaly={anomaly} />
              ))
            ) : (
              <div className="text-center py-10">
                <Shield className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <span className="text-sm text-gray-600">No anomalies detected</span>
              </div>
            )}
          </div>
        </div>

        {/* Incidents panel */}
        <div className="hud-panel opacity-0 animate-slide-up" style={{ animationDelay: '480ms' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-red-400" />
              <h3 className="font-display font-semibold text-sm text-gray-200 tracking-wide">
                INCIDENTS
              </h3>
            </div>
            <span className="text-[10px] font-mono text-gray-600">
              {incidents?.length || 0} total
            </span>
          </div>
          <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
            {incidentsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-lg loading-shimmer" />
                ))}
              </div>
            ) : incidents && incidents.length > 0 ? (
              incidents.slice(0, 5).map((incident: Incident) => (
                <IncidentRow key={incident.id} incident={incident} />
              ))
            ) : (
              <div className="text-center py-10">
                <FileText className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <span className="text-sm text-gray-600">No incidents reported</span>
              </div>
            )}
          </div>
        </div>

        {/* Origin Countries */}
        <div className="hud-panel opacity-0 animate-slide-up" style={{ animationDelay: '530ms' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-radar-400" />
              <h3 className="font-display font-semibold text-sm text-gray-200 tracking-wide">
                TOP ORIGINS
              </h3>
            </div>
            <span className="text-[10px] font-mono text-gray-600">
              by country
            </span>
          </div>
          <div className="p-4">
            {countryDist.length > 0 ? (
              <AircraftTypeBar data={countryDist} />
            ) : (
              <div className="text-center py-10">
                <TrendingUp className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <span className="text-sm text-gray-600">No data available</span>
              </div>
            )}

            {/* Dataset status */}
            {datasetStatus && (
              <div className="mt-5 pt-4 border-t border-hud-border space-y-2">
                <span className="data-label text-[10px]">DATASET STATUS</span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        datasetStatus.aircraftMetadata.loaded ? 'bg-green-500' : 'bg-gray-600',
                      )}
                    />
                    <span className="text-[10px] font-mono text-gray-500">
                      {formatCompact(datasetStatus.aircraftMetadata.count)} aircraft
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        datasetStatus.historicalIncidents.loaded ? 'bg-green-500' : 'bg-gray-600',
                      )}
                    />
                    <span className="text-[10px] font-mono text-gray-500">
                      {formatCompact(datasetStatus.historicalIncidents.seedCount)} ASRS
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline sub-components (kept in same file to avoid new file creation)
// ---------------------------------------------------------------------------

function AnomalyRow({ anomaly }: { anomaly: FlightAnomaly }) {
  return (
    <div
      className={cn(
        'rounded-lg p-3 border transition-all duration-200 hover:border-hud-border-active group cursor-default',
        anomaly.severity === 'critical'
          ? 'bg-red-500/5 border-red-500/15'
          : anomaly.severity === 'high'
            ? 'bg-orange-500/5 border-orange-500/15'
            : 'bg-white/[0.01] border-white/[0.04]',
      )}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full flex-shrink-0',
              anomaly.severity === 'critical'
                ? 'bg-red-500 animate-pulse'
                : anomaly.severity === 'high'
                  ? 'bg-orange-500'
                  : anomaly.severity === 'medium'
                    ? 'bg-yellow-500'
                    : 'bg-blue-500',
            )}
          />
          <span className={cn('text-[12px] font-display font-semibold', getSeverityColor(anomaly.severity))}>
            {getAnomalyLabel(anomaly.type)}
          </span>
        </div>
        <span className="text-[10px] font-mono text-gray-600 flex-shrink-0">
          {formatRelativeTime(anomaly.detected_at)}
        </span>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 mb-2">
        {anomaly.details.description}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-gray-600 tracking-wide">
          {anomaly.callsign || anomaly.flight_icao24}
        </span>
        <ChevronRight className="w-3 h-3 text-gray-700 group-hover:text-radar-400 transition-colors" />
      </div>
    </div>
  );
}

function IncidentRow({ incident }: { incident: Incident }) {
  return (
    <div className="rounded-lg p-3 border bg-white/[0.01] border-white/[0.04] hover:border-hud-border-active transition-all duration-200 group cursor-default">
      <div className="flex items-start justify-between mb-1.5">
        <span className={cn('badge text-[9px] py-0.5 px-1.5', `badge-${incident.severity}`)}>
          {incident.severity}
        </span>
        <span className="text-[10px] font-mono text-gray-600">
          {formatRelativeTime(incident.occurred_at)}
        </span>
      </div>
      <h4 className="text-[12px] font-sans font-semibold text-gray-300 mb-1 line-clamp-1">
        {incident.title}
      </h4>
      <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed mb-2">
        {incident.description}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-gray-600">
          <MapPin className="w-3 h-3" />
          <span className="text-[10px] font-mono">{incident.location?.airport_icao || 'N/A'}</span>
        </div>
        <ChevronRight className="w-3 h-3 text-gray-700 group-hover:text-radar-400 transition-colors" />
      </div>
    </div>
  );
}

function RadarMapInline({ aircraft }: { aircraft: EnrichedAircraft[] }) {
  return (
    <div className="relative w-full min-h-[440px] rounded-lg overflow-hidden bg-void-900">
      {/* Grid */}
      <div className="absolute inset-0 dot-grid opacity-40" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,255,200,0.015) 0%, transparent 70%)',
        }}
      />

      {/* Map silhouette */}
      <div className="absolute inset-0 opacity-10">
        <svg viewBox="0 0 1000 500" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="mapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00ffc8" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path
            d="M150,150 Q200,100 300,120 T450,130 Q500,140 550,120 T650,140 L700,160 Q750,180 800,150 L850,170 L800,220 Q750,250 700,240 L650,260 Q600,280 550,260 L500,280 Q450,300 400,280 L350,300 Q300,320 250,300 L200,280 Q150,260 150,220 Z"
            fill="url(#mapGrad)" stroke="rgba(0,255,200,0.08)" strokeWidth="0.5"
          />
          <path
            d="M100,250 Q150,230 200,250 T300,260 Q350,280 400,320 L350,380 Q300,400 250,380 L200,350 Q150,320 100,340 L80,300 Q90,270 100,250 Z"
            fill="url(#mapGrad)" stroke="rgba(0,255,200,0.08)" strokeWidth="0.5"
          />
          <path
            d="M700,250 Q750,230 800,250 T900,280 L920,350 Q900,400 850,380 L800,350 Q750,320 700,340 L680,300 Q690,270 700,250 Z"
            fill="url(#mapGrad)" stroke="rgba(0,255,200,0.08)" strokeWidth="0.5"
          />
        </svg>
      </div>

      {/* Radar sweep */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-64 h-64">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute rounded-full border"
              style={{
                borderColor: `rgba(0,255,200,${0.05 - i * 0.012})`,
                width: `${i * 33}%`,
                height: `${i * 33}%`,
                top: `${50 - i * 16.5}%`,
                left: `${50 - i * 16.5}%`,
              }}
            />
          ))}
          <div className="absolute inset-0 animate-sweep origin-center">
            <div
              className="absolute top-1/2 left-1/2 w-1/2 h-[1px] origin-left"
              style={{
                background: 'linear-gradient(90deg, rgba(0,255,200,0.5), transparent)',
                boxShadow: '0 0 6px rgba(0,255,200,0.2)',
              }}
            />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-radar-400 rounded-full shadow-glow" />
        </div>
      </div>

      {/* Aircraft dots */}
      <div className="absolute inset-0">
        {aircraft.slice(0, 40).map((ac) => {
          if (!ac.latitude || !ac.longitude) return null;
          const x = ((ac.longitude + 180) / 360) * 100;
          const y = ((90 - ac.latitude) / 180) * 100;
          const isEmergency = isEmergencySquawk(ac.squawk);

          return (
            <div
              key={ac.icao24}
              className="absolute group cursor-pointer"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {/* Ping ring for emergency */}
              {isEmergency && (
                <div className="absolute -inset-2 rounded-full border border-red-500/30 radar-ping" />
              )}
              <div
                className={cn(
                  'w-[5px] h-[5px] rounded-full transition-transform duration-200 group-hover:scale-[2.5]',
                  isEmergency
                    ? 'bg-red-500 shadow-glow-danger animate-pulse'
                    : ac.on_ground
                      ? 'bg-gray-600'
                      : 'bg-radar-400 shadow-glow',
                )}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-void-900/95 border border-hud-border rounded-lg text-[11px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-panel">
                <div className="text-radar-400 font-semibold mb-0.5">
                  {ac.callsign || ac.icao24.toUpperCase()}
                </div>
                {ac.baro_altitude && (
                  <div className="text-gray-500">{formatAltitudeFeet(ac.baro_altitude)}</div>
                )}
                {ac.velocity && (
                  <div className="text-gray-600">{formatSpeed(ac.velocity)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tracking count overlay */}
      <div className="absolute top-3 right-3 px-3 py-2 rounded-lg bg-void-900/85 border border-hud-border backdrop-blur-sm">
        <div className="text-[9px] font-mono text-gray-600 tracking-widest mb-0.5">TRACKING</div>
        <div className="text-lg font-display font-bold text-radar-300 tabular-nums text-glow">
          {formatNumber(aircraft.length)}
        </div>
      </div>
    </div>
  );
}
