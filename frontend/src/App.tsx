// ============================================
// AirSentinel AI - Main Application
// ============================================

import { useState, useEffect } from 'react';
import { 
  Plane, 
  AlertTriangle, 
  Radio, 
  FileText, 
  Search, 
  Activity,
  Radar,
  Globe,
  Zap,
  Shield,
  Clock,
  TrendingUp,
  MapPin,
  Volume2,
  Image,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Settings,
  Bell
} from 'lucide-react';
import { 
  useDashboardStats, 
  useFlights, 
  useAnomalies, 
  useIncidents,
  useLiveATC,
  useNaturalQuery,
  type Aircraft,
  type FlightAnomaly,
  type Incident
} from './api/hooks';
import {
  cn,
  formatNumber,
  formatCompact,
  formatAltitudeFeet,
  formatSpeed,
  formatHeading,
  formatRelativeTime,
  formatTime,
  getSeverityColor,
  getSeverityBg,
  getAnomalyLabel,
  isEmergencySquawk,
  getSquawkInfo
} from './utils';

// ============================================
// Header Component
// ============================================

function Header() {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <header className="glass-panel px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Radar className="w-10 h-10 text-radar-400" />
          <div className="absolute inset-0 animate-ping">
            <Radar className="w-10 h-10 text-radar-400 opacity-30" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wider text-gradient">
            AIRSENTINEL
          </h1>
          <p className="text-xs font-mono text-gray-500 tracking-widest">
            AVIATION INTELLIGENCE PLATFORM
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-mono text-green-400">SYSTEM ONLINE</span>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-display font-bold text-radar-200 tabular-nums">
            {time.toLocaleTimeString('en-US', { hour12: false })}
          </div>
          <div className="text-xs font-mono text-gray-500">
            {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} UTC
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-400 hover:text-white hover:bg-sky-border rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-white hover:bg-sky-border rounded-lg transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

// ============================================
// Stats Card Component
// ============================================

function StatsCard({ 
  icon: Icon, 
  label, 
  value, 
  trend, 
  color = 'radar' 
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  trend?: string;
  color?: 'radar' | 'yellow' | 'red' | 'blue';
}) {
  const colorClasses = {
    radar: 'text-radar-400 bg-radar-500/10 border-radar-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  };
  
  return (
    <div className="stat-card group hover:border-radar-500/30 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-3 rounded-xl border', colorClasses[color])}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-green-400 text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="data-value mb-1">{typeof value === 'number' ? formatCompact(value) : value}</div>
      <div className="data-label">{label}</div>
    </div>
  );
}

// ============================================
// Flight Card Component
// ============================================

function FlightCard({ aircraft, anomaly }: { aircraft: Aircraft; anomaly?: FlightAnomaly }) {
  const squawkInfo = getSquawkInfo(aircraft.squawk);
  const hasEmergency = isEmergencySquawk(aircraft.squawk);
  
  return (
    <div className={cn(
      'p-4 rounded-lg border transition-all hover:border-radar-500/50',
      hasEmergency ? 'bg-red-500/10 border-red-500/50' : 'bg-sky-dark/50 border-sky-border',
      anomaly && !hasEmergency && getSeverityBg(anomaly.severity)
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            hasEmergency ? 'bg-red-500/20' : 'bg-radar-500/20'
          )}>
            <Plane 
              className={cn('w-5 h-5', hasEmergency ? 'text-red-400' : 'text-radar-400')}
              style={{ transform: `rotate(${aircraft.true_track || 0}deg)` }}
            />
          </div>
          <div>
            <div className="font-display font-bold text-lg">
              {aircraft.callsign || aircraft.icao24.toUpperCase()}
            </div>
            <div className="text-xs text-gray-500 font-mono">{aircraft.icao24.toUpperCase()}</div>
          </div>
        </div>
        
        {squawkInfo && (
          <div className="px-2 py-1 bg-red-500/20 border border-red-500/50 rounded text-xs font-bold text-red-400 animate-pulse">
            {aircraft.squawk} - {squawkInfo.name}
          </div>
        )}
        
        {anomaly && !hasEmergency && (
          <div className={cn('px-2 py-1 border rounded text-xs font-medium', getSeverityBg(anomaly.severity), getSeverityColor(anomaly.severity))}>
            {getAnomalyLabel(anomaly.type)}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-500 text-xs mb-1">ALTITUDE</div>
          <div className="font-mono text-gray-200">{formatAltitudeFeet(aircraft.baro_altitude)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">SPEED</div>
          <div className="font-mono text-gray-200">{formatSpeed(aircraft.velocity)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">HEADING</div>
          <div className="font-mono text-gray-200">{formatHeading(aircraft.true_track)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">ORIGIN</div>
          <div className="font-mono text-gray-200 truncate">{aircraft.origin_country}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Anomaly Card Component
// ============================================

function AnomalyCard({ anomaly }: { anomaly: FlightAnomaly }) {
  return (
    <div className={cn(
      'p-4 rounded-lg border',
      getSeverityBg(anomaly.severity)
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn('w-5 h-5', getSeverityColor(anomaly.severity))} />
          <span className={cn('font-semibold', getSeverityColor(anomaly.severity))}>
            {getAnomalyLabel(anomaly.type)}
          </span>
        </div>
        <span className="text-xs text-gray-500">{formatRelativeTime(anomaly.detected_at)}</span>
      </div>
      
      <div className="text-sm text-gray-300 mb-2">
        {anomaly.details.description}
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-gray-400">
          {anomaly.callsign || anomaly.flight_icao24}
        </span>
        <button className="flex items-center gap-1 text-radar-400 hover:text-radar-300 transition-colors">
          Details <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// Incident Card Component
// ============================================

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <div className="p-4 bg-sky-dark/50 border border-sky-border rounded-lg hover:border-radar-500/30 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <span className={cn(
          'px-2 py-0.5 text-xs font-medium rounded border',
          getSeverityBg(incident.severity),
          getSeverityColor(incident.severity)
        )}>
          {incident.severity.toUpperCase()}
        </span>
        <span className="text-xs text-gray-500">{formatRelativeTime(incident.occurred_at)}</span>
      </div>
      
      <h4 className="font-semibold text-gray-200 mb-1">{incident.title}</h4>
      <p className="text-sm text-gray-400 line-clamp-2 mb-3">{incident.description}</p>
      
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-gray-500">
          <MapPin className="w-4 h-4" />
          <span>{incident.location?.airport_icao || 'Location N/A'}</span>
        </div>
        <span className="px-2 py-0.5 bg-sky-border rounded text-gray-400">
          {incident.source.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

// ============================================
// ATC Feed Component
// ============================================

function ATCFeed() {
  const { data, isLoading } = useLiveATC();
  
  if (isLoading) {
    return <div className="text-gray-500 text-center py-8">Loading ATC feed...</div>;
  }
  
  const transmissions = data?.recent_transmissions || [];
  
  return (
    <div className="space-y-3">
      {transmissions.map((tx: any, i: number) => (
        <div key={i} className="p-3 bg-sky-dark/50 border border-sky-border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className={cn(
              'px-2 py-0.5 text-xs font-mono rounded',
              tx.speaker === 'atc' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
            )}>
              {tx.speaker.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500">{formatTime(tx.timestamp)}</span>
          </div>
          <p className="text-sm text-gray-300 font-mono">{tx.text}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Query Panel Component
// ============================================

function QueryPanel() {
  const [query, setQuery] = useState('');
  const naturalQuery = useNaturalQuery();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      naturalQuery.mutate(query);
    }
  };
  
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about flights, incidents, or aviation data..."
          className="input-field pl-12 pr-24"
        />
        <button
          type="submit"
          disabled={naturalQuery.isPending}
          className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary text-sm py-1.5"
        >
          {naturalQuery.isPending ? 'Analyzing...' : 'Ask AI'}
        </button>
      </form>
      
      {naturalQuery.data && (
        <div className="p-4 bg-radar-500/10 border border-radar-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-radar-400" />
            <span className="text-sm font-medium text-radar-400">AI Response</span>
          </div>
          <p className="text-gray-300">{naturalQuery.data.response}</p>
          {naturalQuery.data.suggested_followups && (
            <div className="mt-3 flex flex-wrap gap-2">
              {naturalQuery.data.suggested_followups.map((followup: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setQuery(followup)}
                  className="text-xs px-3 py-1 bg-sky-border hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  {followup}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-2">
        {[
          'Show emergency flights',
          'Recent incidents near LAX',
          'Holding patterns today',
          'Aviation safety summary'
        ].map((suggestion, i) => (
          <button
            key={i}
            onClick={() => setQuery(suggestion)}
            className="text-left text-sm p-3 bg-sky-dark/50 border border-sky-border hover:border-radar-500/30 rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Map Placeholder Component
// ============================================

function MapPlaceholder() {
  const { data: flightsData } = useFlights({ limit: 50 });
  const aircraft = flightsData?.aircraft || [];
  
  return (
    <div className="relative w-full h-full min-h-[500px] bg-sky-dark rounded-xl overflow-hidden border border-sky-border">
      {/* Grid overlay */}
      <div className="absolute inset-0 grid-overlay opacity-50" />
      
      {/* Simulated world map background */}
      <div className="absolute inset-0 opacity-20">
        <svg viewBox="0 0 1000 500" className="w-full h-full">
          <defs>
            <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00ffc8" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#0066ff" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {/* Simplified continent outlines */}
          <path
            d="M150,150 Q200,100 300,120 T450,130 Q500,140 550,120 T650,140 L700,160 Q750,180 800,150 L850,170 L800,220 Q750,250 700,240 L650,260 Q600,280 550,260 L500,280 Q450,300 400,280 L350,300 Q300,320 250,300 L200,280 Q150,260 150,220 Z"
            fill="url(#mapGradient)"
            stroke="#00ffc8"
            strokeWidth="0.5"
          />
          <path
            d="M100,250 Q150,230 200,250 T300,260 Q350,280 400,320 L350,380 Q300,400 250,380 L200,350 Q150,320 100,340 L80,300 Q90,270 100,250 Z"
            fill="url(#mapGradient)"
            stroke="#00ffc8"
            strokeWidth="0.5"
          />
          <path
            d="M700,250 Q750,230 800,250 T900,280 L920,350 Q900,400 850,380 L800,350 Q750,320 700,340 L680,300 Q690,270 700,250 Z"
            fill="url(#mapGradient)"
            stroke="#00ffc8"
            strokeWidth="0.5"
          />
        </svg>
      </div>
      
      {/* Radar sweep effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-80 h-80">
          {/* Concentric circles */}
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute rounded-full border border-radar-500/20"
              style={{
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
              className="absolute top-1/2 left-1/2 w-1/2 h-0.5 origin-left"
              style={{
                background: 'linear-gradient(90deg, rgba(0,255,200,0.8), transparent)',
              }}
            />
          </div>
          
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-radar-400 rounded-full radar-glow" />
        </div>
      </div>
      
      {/* Simulated aircraft positions */}
      <div className="absolute inset-0">
        {aircraft.slice(0, 30).map((ac) => {
          if (!ac.latitude || !ac.longitude) return null;
          // Map coordinates to viewport (simplified projection)
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
                  'w-2 h-2 rounded-full transition-all',
                  isEmergencySquawk(ac.squawk) 
                    ? 'bg-red-500 animate-pulse' 
                    : ac.on_ground 
                      ? 'bg-gray-500' 
                      : 'bg-radar-400'
                )}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-sky-panel border border-sky-border rounded text-xs font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {ac.callsign || ac.icao24}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 p-3 glass-panel text-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-radar-400 rounded-full" />
          <span className="text-gray-400">Airborne</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-gray-500 rounded-full" />
          <span className="text-gray-400">On Ground</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-gray-400">Emergency</span>
        </div>
      </div>
      
      {/* Stats overlay */}
      <div className="absolute top-4 right-4 p-3 glass-panel text-xs">
        <div className="text-gray-500 mb-1">TRACKING</div>
        <div className="text-2xl font-display font-bold text-radar-300">
          {formatNumber(aircraft.length)}
        </div>
        <div className="text-gray-500">aircraft</div>
      </div>
    </div>
  );
}

// ============================================
// Navigation Tabs
// ============================================

type TabId = 'overview' | 'flights' | 'anomalies' | 'incidents' | 'atc' | 'query';

function NavigationTabs({ 
  activeTab, 
  onTabChange 
}: { 
  activeTab: TabId; 
  onTabChange: (tab: TabId) => void;
}) {
  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Globe },
    { id: 'flights', label: 'Flights', icon: Plane },
    { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
    { id: 'incidents', label: 'Incidents', icon: FileText },
    { id: 'atc', label: 'ATC Feed', icon: Radio },
    { id: 'query', label: 'AI Query', icon: MessageSquare },
  ];
  
  return (
    <nav className="flex gap-1 p-1 bg-sky-panel/50 rounded-xl border border-sky-border">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
            activeTab === id
              ? 'bg-radar-500/20 text-radar-400 border border-radar-500/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-sky-border/50'
          )}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden md:inline">{label}</span>
        </button>
      ))}
    </nav>
  );
}

// ============================================
// Main App Component
// ============================================

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: flightsData, isLoading: flightsLoading } = useFlights({ limit: 20 });
  const { data: anomalies, isLoading: anomaliesLoading } = useAnomalies({ limit: 10 });
  const { data: incidents, isLoading: incidentsLoading } = useIncidents({ limit: 10 });
  
  const aircraft = flightsData?.aircraft || [];
  const flightAnomalies = flightsData?.anomalies || [];
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 p-6 space-y-6">
        {/* Navigation */}
        <NavigationTabs activeTab={activeTab} onTabChange={setActiveTab} />
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                icon={Plane}
                label="Flights Tracked"
                value={stats?.flights_tracked || 0}
                trend="+2.4%"
                color="radar"
              />
              <StatsCard
                icon={AlertTriangle}
                label="Active Anomalies"
                value={stats?.active_anomalies || anomalies?.length || 0}
                color="yellow"
              />
              <StatsCard
                icon={FileText}
                label="Incidents Today"
                value={stats?.incidents_today || 0}
                color="red"
              />
              <StatsCard
                icon={Radio}
                label="ATC Processed"
                value={stats?.atc_communications_processed || 0}
                color="blue"
              />
            </div>
            
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Map */}
              <div className="xl:col-span-2">
                <div className="glass-panel p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-display font-bold text-gray-200">
                      Live Flight Tracking
                    </h2>
                    <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-radar-400 transition-colors">
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </button>
                  </div>
                  <MapPlaceholder />
                </div>
              </div>
              
              {/* Sidebar */}
              <div className="space-y-6">
                {/* Recent Anomalies */}
                <div className="glass-panel p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-bold text-gray-200 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      Recent Anomalies
                    </h3>
                    <button 
                      onClick={() => setActiveTab('anomalies')}
                      className="text-sm text-radar-400 hover:text-radar-300"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {anomaliesLoading ? (
                      <div className="text-gray-500 text-center py-4">Loading...</div>
                    ) : anomalies && anomalies.length > 0 ? (
                      anomalies.slice(0, 4).map((anomaly: FlightAnomaly) => (
                        <AnomalyCard key={anomaly.id} anomaly={anomaly} />
                      ))
                    ) : flightAnomalies.length > 0 ? (
                      flightAnomalies.slice(0, 4).map((anomaly: FlightAnomaly) => (
                        <AnomalyCard key={anomaly.id} anomaly={anomaly} />
                      ))
                    ) : (
                      <div className="text-gray-500 text-center py-4">
                        No anomalies detected
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Recent Incidents */}
                <div className="glass-panel p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-bold text-gray-200 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-red-400" />
                      Recent Incidents
                    </h3>
                    <button 
                      onClick={() => setActiveTab('incidents')}
                      className="text-sm text-radar-400 hover:text-radar-300"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {incidentsLoading ? (
                      <div className="text-gray-500 text-center py-4">Loading...</div>
                    ) : incidents && incidents.length > 0 ? (
                      incidents.slice(0, 3).map((incident: Incident) => (
                        <IncidentCard key={incident.id} incident={incident} />
                      ))
                    ) : (
                      <div className="text-gray-500 text-center py-4">No incidents reported</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Flights Tab */}
        {activeTab === 'flights' && (
          <div className="glass-panel p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-gray-200">
                Active Flights
              </h2>
              <div className="text-sm text-gray-500">
                Showing {aircraft.length} aircraft
              </div>
            </div>
            {flightsLoading ? (
              <div className="text-gray-500 text-center py-12">Loading flights...</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {aircraft.map((ac: Aircraft) => {
                  const anomaly = flightAnomalies.find(a => a.flight_icao24 === ac.icao24);
                  return <FlightCard key={ac.icao24} aircraft={ac} anomaly={anomaly} />;
                })}
              </div>
            )}
          </div>
        )}
        
        {/* Anomalies Tab */}
        {activeTab === 'anomalies' && (
          <div className="glass-panel p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-gray-200">
                Detected Anomalies
              </h2>
              <div className="flex gap-2">
                {['critical', 'high', 'medium', 'low'].map(severity => (
                  <button 
                    key={severity}
                    className={cn(
                      'px-3 py-1 rounded-lg text-sm border transition-colors',
                      getSeverityBg(severity),
                      getSeverityColor(severity)
                    )}
                  >
                    {severity}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(anomalies || flightAnomalies).map((anomaly: FlightAnomaly) => (
                <AnomalyCard key={anomaly.id} anomaly={anomaly} />
              ))}
              {(!anomalies || anomalies.length === 0) && flightAnomalies.length === 0 && (
                <div className="col-span-full text-gray-500 text-center py-12">
                  No anomalies detected
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Incidents Tab */}
        {activeTab === 'incidents' && (
          <div className="glass-panel p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-gray-200">
                Aviation Incidents
              </h2>
              <button className="btn-primary text-sm">
                Report Incident
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {incidentsLoading ? (
                <div className="col-span-full text-gray-500 text-center py-12">Loading incidents...</div>
              ) : incidents && incidents.length > 0 ? (
                incidents.map((incident: Incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))
              ) : (
                <div className="col-span-full text-gray-500 text-center py-12">No incidents reported</div>
              )}
            </div>
          </div>
        )}
        
        {/* ATC Tab */}
        {activeTab === 'atc' && (
          <div className="glass-panel p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-gray-200 flex items-center gap-2">
                <Volume2 className="w-6 h-6 text-blue-400" />
                Live ATC Communications
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-gray-400">Connected - KLAX Tower</span>
              </div>
            </div>
            <ATCFeed />
          </div>
        )}
        
        {/* AI Query Tab */}
        {activeTab === 'query' && (
          <div className="glass-panel p-6 animate-fade-in">
            <div className="mb-6">
              <h2 className="text-xl font-display font-bold text-gray-200 flex items-center gap-2 mb-2">
                <MessageSquare className="w-6 h-6 text-radar-400" />
                AI-Powered Aviation Query
              </h2>
              <p className="text-gray-400">
                Ask natural language questions about flights, incidents, airspace activity, and more.
              </p>
            </div>
            <QueryPanel />
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="px-6 py-4 border-t border-sky-border">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>AirSentinel AI v1.0</span>
            <span>•</span>
            <span>Data: OpenSky Network</span>
            <span>•</span>
            <span>AI: Hugging Face</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Last updated: {stats?.last_updated ? formatRelativeTime(stats.last_updated) : 'N/A'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
