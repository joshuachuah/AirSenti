import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plane,
  Search,
  LayoutGrid,
  List,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Crosshair,
  BarChart3,
  X,
  ArrowUpDown,
  MapPin,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  useFlights,
  type EnrichedAircraft,
  type FlightAnomaly,
} from '../api/hooks';
import {
  cn,
  formatNumber,
  formatCompact,
  formatAltitudeFeet,
  formatSpeed,
  formatHeading,
  formatVerticalRate,
  formatCoordinates,
  isEmergencySquawk,
  getSquawkInfo,
  getSeverityBg,
  getAnomalyLabel,
  debounce,
} from '../utils';
import { FlightCard } from '../components/FlightCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type StatusFilter = 'all' | 'airborne' | 'ground' | 'emergency';
type SortField = 'callsign' | 'altitude' | 'speed' | 'vrate';
type SortDir = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';

// ---------------------------------------------------------------------------
// Summary Strip
// ---------------------------------------------------------------------------
function SummaryStrip({
  total,
  airborne,
  grounded,
  emergencies,
  avgAlt,
}: {
  total: number;
  airborne: number;
  grounded: number;
  emergencies: number;
  avgAlt: number;
}) {
  const metrics = [
    { label: 'TRACKED', value: total, icon: Plane, color: 'text-radar-400', bg: 'bg-radar-400/8', glow: 'rgba(0,255,200,0.15)' },
    { label: 'AIRBORNE', value: airborne, icon: ArrowUpRight, color: 'text-radar-400', bg: 'bg-radar-400/8', glow: 'rgba(0,255,200,0.15)' },
    { label: 'GROUND', value: grounded, icon: Plane, color: 'text-gray-400', bg: 'bg-gray-400/8', glow: 'none' },
    { label: 'EMERGENCY', value: emergencies, icon: AlertTriangle, color: emergencies > 0 ? 'text-red-400' : 'text-gray-500', bg: emergencies > 0 ? 'bg-red-400/8' : 'bg-gray-400/5', glow: emergencies > 0 ? 'rgba(239,68,68,0.2)' : 'none' },
    { label: 'AVG ALT', value: `${formatCompact(avgAlt)} ft`, icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-400/8', glow: 'rgba(59,130,246,0.15)' },
  ];

  return (
    <div className="hud-panel p-0 overflow-hidden opacity-0 animate-slide-up stagger-1">
      <div className="relative">
        <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 50% 100% at 0% 50%, rgba(0,255,200,0.025) 0%, transparent 70%), radial-gradient(ellipse 40% 100% at 100% 50%, rgba(59,130,246,0.015) 0%, transparent 70%)',
          }}
        />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Crosshair className="w-4 h-4 text-radar-400" />
            <span className="data-label">FLIGHT OPERATIONS</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg border border-white/[0.04]', m.bg)}>
                  <m.icon className={cn('w-4 h-4', m.color)} />
                </div>
                <div>
                  <span
                    className={cn('block text-2xl font-display font-bold tabular-nums', m.color)}
                    style={{ textShadow: m.glow !== 'none' ? `0 0 20px ${m.glow}` : undefined }}
                  >
                    {typeof m.value === 'number' ? formatNumber(m.value) : m.value}
                  </span>
                  <span className="data-label text-[9px]">{m.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------
function Toolbar({
  searchInput,
  onSearchInput,
  statusFilter,
  onStatusFilter,
  sortBy,
  sortDir,
  onSort,
  viewMode,
  onViewMode,
}: {
  searchInput: string;
  onSearchInput: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilter: (v: StatusFilter) => void;
  sortBy: SortField;
  sortDir: SortDir;
  onSort: (field: SortField, dir: SortDir) => void;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    if (sortOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortOpen]);

  const statusButtons: { key: StatusFilter; label: string; dot?: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'airborne', label: 'AIR' },
    { key: 'ground', label: 'GND' },
    { key: 'emergency', label: 'EMG', dot: 'bg-red-500' },
  ];

  const sortOptions: { key: SortField; label: string }[] = [
    { key: 'callsign', label: 'Callsign' },
    { key: 'altitude', label: 'Altitude' },
    { key: 'speed', label: 'Speed' },
    { key: 'vrate', label: 'Vert Rate' },
  ];

  return (
    <div className="hud-panel px-4 py-3 opacity-0 animate-slide-up stagger-2">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            className="input-field pl-10 py-2 text-sm"
            placeholder="Search callsign, ICAO24, reg..."
            value={searchInput}
            onChange={(e) => onSearchInput(e.target.value)}
          />
        </div>

        <div className="hidden md:block w-px h-6 bg-hud-border" />

        {/* Status filters */}
        <div className="flex items-center gap-1">
          {statusButtons.map((s) => (
            <button
              key={s.key}
              onClick={() => onStatusFilter(s.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-display font-semibold uppercase tracking-wider transition-all duration-200 border',
                statusFilter === s.key
                  ? 'bg-radar-400/10 text-radar-400 border-radar-400/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border-transparent',
              )}
            >
              <span className="flex items-center gap-1.5">
                {s.dot && <span className={cn('w-1.5 h-1.5 rounded-full inline-block', s.dot)} />}
                {s.label}
              </span>
            </button>
          ))}
        </div>

        <div className="hidden md:block w-px h-6 bg-hud-border" />

        {/* Sort dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-display font-semibold uppercase tracking-wider transition-all duration-200 border',
              sortOpen
                ? 'bg-radar-400/10 text-radar-400 border-radar-400/20'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border-transparent',
            )}
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortBy}
            <span className="text-gray-600">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
          </button>
          {sortOpen && (
            <div className="absolute top-full mt-1 left-0 z-50 w-44 hud-panel p-1.5 shadow-panel">
              {sortOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (sortBy === opt.key) {
                      onSort(opt.key, sortDir === 'asc' ? 'desc' : 'asc');
                    } else {
                      onSort(opt.key, 'desc');
                    }
                    setSortOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-[12px] font-display transition-colors',
                    sortBy === opt.key
                      ? 'text-radar-400 bg-radar-400/5'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]',
                  )}
                >
                  <span className="flex items-center justify-between">
                    {opt.label}
                    {sortBy === opt.key && (
                      <span className="text-[10px] text-gray-600">
                        {sortDir === 'asc' ? 'ASC' : 'DESC'}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 md:ml-auto">
          <button
            onClick={() => onViewMode('grid')}
            className={cn(
              'btn-ghost p-2',
              viewMode === 'grid' && 'text-radar-400 bg-radar-400/5',
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewMode('table')}
            className={cn(
              'btn-ghost p-2',
              viewMode === 'table' && 'text-radar-400 bg-radar-400/5',
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flight Table (compact list view)
// ---------------------------------------------------------------------------
function FlightTable({
  aircraft,
  anomalies,
  selectedIcao24,
  onSelect,
}: {
  aircraft: EnrichedAircraft[];
  anomalies: FlightAnomaly[];
  selectedIcao24: string | null;
  onSelect: (icao24: string) => void;
}) {
  return (
    <div className="hud-panel overflow-hidden opacity-0 animate-slide-up stagger-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hud-border">
              {['', 'CALLSIGN', 'ICAO24', 'TYPE', 'ALT', 'SPD', 'HDG', 'V/S', 'ORIGIN', 'STATUS'].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left data-label text-[10px] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aircraft.map((ac) => {
              const hasEmergency = isEmergencySquawk(ac.squawk);
              const anomaly = anomalies.find((a) => a.flight_icao24 === ac.icao24);
              const vrate = ac.vertical_rate || 0;

              return (
                <tr
                  key={ac.icao24}
                  onClick={() => onSelect(ac.icao24)}
                  className={cn(
                    'border-b border-white/[0.03] cursor-pointer transition-colors duration-150',
                    'hover:bg-radar-400/[0.03]',
                    selectedIcao24 === ac.icao24 &&
                      'bg-radar-400/[0.05] border-l-2 border-l-radar-400',
                    hasEmergency && 'bg-red-500/[0.03]',
                  )}
                >
                  {/* Status dot */}
                  <td className="px-3 py-2.5">
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        hasEmergency
                          ? 'bg-red-500 animate-pulse'
                          : ac.on_ground
                            ? 'bg-gray-500'
                            : 'bg-radar-400',
                      )}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-display font-semibold text-gray-200 whitespace-nowrap">
                    {ac.callsign || '---'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500 uppercase">
                    {ac.icao24}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-radar-500">
                    {ac.metadata?.typecode || '---'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-gray-300 tabular-nums">
                    {formatAltitudeFeet(ac.baro_altitude)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-gray-300 tabular-nums">
                    {formatSpeed(ac.velocity)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-gray-400 tabular-nums">
                    {formatHeading(ac.true_track)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[12px] tabular-nums">
                    <span
                      className={cn(
                        vrate > 0
                          ? 'text-green-400'
                          : vrate < 0
                            ? 'text-orange-400'
                            : 'text-gray-500',
                      )}
                    >
                      {formatVerticalRate(ac.vertical_rate)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500">
                    {ac.origin_country}
                  </td>
                  <td className="px-3 py-2.5">
                    {hasEmergency ? (
                      <span className="badge badge-critical text-[9px] py-0.5 px-1.5">
                        {getSquawkInfo(ac.squawk)?.name}
                      </span>
                    ) : anomaly ? (
                      <span
                        className={cn(
                          'badge text-[9px] py-0.5 px-1.5',
                          `badge-${anomaly.severity}`,
                        )}
                      >
                        {getAnomalyLabel(anomaly.type)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-gray-600">
                        {ac.on_ground ? 'GND' : 'AIR'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flight Detail Panel
// ---------------------------------------------------------------------------
function FlightDetailPanel({
  aircraft: ac,
  anomalies,
  onClose,
}: {
  aircraft: EnrichedAircraft;
  anomalies: FlightAnomaly[];
  onClose: () => void;
}) {
  const meta = ac.metadata;

  return (
    <div
      className="fixed top-0 right-0 h-full w-[400px] z-50 flex flex-col
                 bg-void-900/95 backdrop-blur-xl border-l border-hud-border
                 shadow-[-8px_0_30px_rgba(0,0,0,0.5)]
                 opacity-0 animate-slide-right"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-hud-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-radar-400" />
          <span className="font-display font-bold text-sm tracking-[0.1em] text-gray-200">
            FLIGHT DETAIL
          </span>
        </div>
        <button onClick={onClose} className="btn-ghost p-1.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <>
            {/* Identity */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={cn(
                    'p-2.5 rounded-lg border',
                    isEmergencySquawk(ac.squawk)
                      ? 'bg-red-500/15 border-red-500/30'
                      : 'bg-radar-400/8 border-radar-400/15',
                  )}
                >
                  <Plane
                    className={cn(
                      'w-6 h-6',
                      isEmergencySquawk(ac.squawk) ? 'text-red-400' : 'text-radar-400',
                    )}
                    style={{ transform: `rotate(${ac.true_track || 0}deg)` }}
                  />
                </div>
                <div>
                  <div className="font-display font-bold text-xl text-gray-100 text-glow">
                    {ac.callsign || ac.icao24.toUpperCase()}
                  </div>
                  <div className="text-[11px] font-mono text-gray-500">
                    {ac.icao24.toUpperCase()}
                    {meta?.registration && ` / ${meta.registration}`}
                  </div>
                </div>
              </div>

              {/* Metadata grid */}
              {meta && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'REG', value: meta.registration },
                    { label: 'TYPE', value: meta.typecode },
                    { label: 'MODEL', value: meta.model },
                    { label: 'MFR', value: meta.manufacturerName },
                    { label: 'OPERATOR', value: meta.operator },
                    { label: 'OWNER', value: meta.owner },
                    { label: 'BUILT', value: meta.built },
                    { label: 'ENGINES', value: meta.engines },
                  ]
                    .filter((x) => x.value)
                    .map(({ label, value }) => (
                      <div
                        key={label}
                        className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                      >
                        <div className="data-label text-[9px] mb-0.5">{label}</div>
                        <div className="font-mono text-[12px] text-gray-300 truncate">
                          {value}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Flight data */}
            <div>
              <h4 className="data-label text-[10px] mb-3">FLIGHT DATA</h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'ALT', value: formatAltitudeFeet(ac.baro_altitude) },
                  { label: 'SPD', value: formatSpeed(ac.velocity) },
                  { label: 'HDG', value: formatHeading(ac.true_track) },
                  {
                    label: 'V/S',
                    value: formatVerticalRate(ac.vertical_rate),
                    color:
                      (ac.vertical_rate || 0) > 0
                        ? 'text-green-400'
                        : (ac.vertical_rate || 0) < 0
                          ? 'text-orange-400'
                          : '',
                  },
                  { label: 'SQUAWK', value: ac.squawk || 'N/A' },
                  {
                    label: 'STATUS',
                    value: ac.on_ground ? 'GROUND' : 'AIRBORNE',
                    color: ac.on_ground ? 'text-gray-400' : 'text-radar-400',
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="stat-card p-3">
                    <div className="data-label text-[9px] mb-1">{label}</div>
                    <div
                      className={cn(
                        'font-mono text-sm text-gray-200 tabular-nums',
                        color,
                      )}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Position */}
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="w-3 h-3 text-radar-500" />
                <span className="data-label text-[10px]">POSITION</span>
              </div>
              <div className="font-mono text-sm text-radar-400">
                {formatCoordinates(ac.latitude, ac.longitude)}
              </div>
            </div>

            {/* Anomalies */}
            {anomalies.length > 0 && (
              <div>
                <h4 className="data-label text-[10px] mb-3">ANOMALIES</h4>
                <div className="space-y-2">
                  {anomalies.map((anomaly) => (
                    <div
                      key={anomaly.id}
                      className={cn(
                        'p-3 rounded-lg border',
                        getSeverityBg(anomaly.severity),
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            'badge text-[9px]',
                            `badge-${anomaly.severity}`,
                          )}
                        >
                          {anomaly.severity}
                        </span>
                        <span className="font-display font-semibold text-[12px] text-gray-200">
                          {getAnomalyLabel(anomaly.type)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        {anomaly.details.description}
                      </p>
                      {anomaly.ai_analysis && (
                        <div className="mt-2 pt-2 border-t border-white/[0.04]">
                          <div className="data-label text-[9px] mb-1">AI ANALYSIS</div>
                          <p className="text-[11px] text-radar-500 leading-relaxed">
                            {anomaly.ai_analysis}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Altitude Distribution Bar
// ---------------------------------------------------------------------------
function AltitudeDistributionBar({ aircraft }: { aircraft: EnrichedAircraft[] }) {
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

  return (
    <div
      className="hud-panel opacity-0 animate-slide-up"
      style={{ animationDelay: '400ms' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
          <h3 className="font-display font-semibold text-sm text-gray-200 tracking-wide">
            ALTITUDE DISTRIBUTION
          </h3>
        </div>
        <span className="text-[10px] font-mono text-gray-600">ft MSL bands</span>
      </div>
      <div className="p-4 h-28">
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
              cursor={{ fill: 'rgba(0,255,200,0.03)' }}
            />
            <Bar dataKey="flights" fill="rgba(0,255,200,0.35)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Flights Page
// ---------------------------------------------------------------------------
export function Flights() {
  const { data: flightsData, isLoading } = useFlights({ limit: 100 });
  const aircraft = flightsData?.aircraft || [];
  const flightAnomalies = flightsData?.anomalies || [];

  // Search state (debounced)
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useMemo(
    () => debounce((q: string) => setSearchQuery(q), 250),
    [],
  );
  function handleSearchInput(val: string) {
    setSearchInput(val);
    debouncedSearch(val);
  }

  // Filters & sort
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortField>('callsign');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIcao24, setSelectedIcao24] = useState<string | null>(null);

  // Derived stats
  const airborne = aircraft.filter((a) => !a.on_ground).length;
  const grounded = aircraft.filter((a) => a.on_ground).length;
  const emergencies = aircraft.filter((a) => isEmergencySquawk(a.squawk)).length;
  const avgAlt = useMemo(() => {
    const alts = aircraft
      .filter((a) => a.baro_altitude && !a.on_ground)
      .map((a) => a.baro_altitude!);
    return alts.length
      ? Math.round((alts.reduce((s, v) => s + v, 0) / alts.length) * 3.281)
      : 0;
  }, [aircraft]);

  // Filtered & sorted
  const filteredAircraft = useMemo(() => {
    let list = [...aircraft];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (ac) =>
          ac.callsign?.toLowerCase().includes(q) ||
          ac.icao24.toLowerCase().includes(q) ||
          ac.metadata?.registration?.toLowerCase().includes(q),
      );
    }

    // Status
    if (statusFilter === 'airborne') list = list.filter((ac) => !ac.on_ground);
    if (statusFilter === 'ground') list = list.filter((ac) => ac.on_ground);
    if (statusFilter === 'emergency')
      list = list.filter((ac) => isEmergencySquawk(ac.squawk));

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'callsign':
          cmp = (a.callsign || a.icao24).localeCompare(b.callsign || b.icao24);
          break;
        case 'altitude':
          cmp = (a.baro_altitude || 0) - (b.baro_altitude || 0);
          break;
        case 'speed':
          cmp = (a.velocity || 0) - (b.velocity || 0);
          break;
        case 'vrate':
          cmp = (a.vertical_rate || 0) - (b.vertical_rate || 0);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [aircraft, searchQuery, statusFilter, sortBy, sortDir]);

  return (
    <div className="space-y-4">
      {/* Summary Strip */}
      <SummaryStrip
        total={aircraft.length}
        airborne={airborne}
        grounded={grounded}
        emergencies={emergencies}
        avgAlt={avgAlt}
      />

      {/* Toolbar */}
      <Toolbar
        searchInput={searchInput}
        onSearchInput={handleSearchInput}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={(field, dir) => {
          setSortBy(field);
          setSortDir(dir);
        }}
        viewMode={viewMode}
        onViewMode={setViewMode}
      />

      {/* Results indicator */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-mono text-gray-600">
          {filteredAircraft.length} of {aircraft.length} flights
          {searchQuery && (
            <span className="text-gray-500">
              {' '}
              matching &ldquo;{searchQuery}&rdquo;
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-radar-400 animate-pulse" />
          <span className="text-[10px] font-mono text-gray-600">LIVE 15s</span>
        </div>
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl loading-shimmer" />
          ))}
        </div>
      ) : filteredAircraft.length === 0 ? (
        <div className="hud-panel p-16 text-center">
          <Plane className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-display">
            No flights match your criteria
          </p>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchInput('');
                setSearchQuery('');
              }}
              className="mt-3 text-[12px] font-display text-radar-500 hover:text-radar-400 transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredAircraft.map((ac, i) => {
            const anomaly = flightAnomalies.find(
              (a) => a.flight_icao24 === ac.icao24,
            );
            return (
              <div
                key={ac.icao24}
                className="opacity-0 animate-slide-up"
                style={{ animationDelay: `${Math.min(i * 0.03, 0.5)}s` }}
              >
                <FlightCard
                  aircraft={ac}
                  anomaly={anomaly}
                  onClick={() => setSelectedIcao24(ac.icao24)}
                  isSelected={selectedIcao24 === ac.icao24}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <FlightTable
          aircraft={filteredAircraft}
          anomalies={flightAnomalies}
          selectedIcao24={selectedIcao24}
          onSelect={setSelectedIcao24}
        />
      )}

      {/* Altitude Distribution */}
      <AltitudeDistributionBar aircraft={aircraft} />

      {/* Detail Panel Overlay */}
      {selectedIcao24 && (() => {
        const selectedAc = aircraft.find((a) => a.icao24 === selectedIcao24);
        if (!selectedAc) return null;
        const selectedAnomalies = flightAnomalies.filter(
          (a) => a.flight_icao24 === selectedIcao24,
        );
        return (
          <>
            <div
              className="fixed inset-0 bg-void-950/40 backdrop-blur-sm z-40"
              onClick={() => setSelectedIcao24(null)}
            />
            <FlightDetailPanel
              aircraft={selectedAc}
              anomalies={selectedAnomalies}
              onClose={() => setSelectedIcao24(null)}
            />
          </>
        );
      })()}
    </div>
  );
}
