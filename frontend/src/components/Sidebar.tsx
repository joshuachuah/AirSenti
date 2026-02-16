import { useState } from 'react';
import {
  Globe,
  Plane,
  AlertTriangle,
  FileText,
  Radio,
  MessageSquare,
  Database,
  ChevronLeft,
  ChevronRight,
  Radar,
} from 'lucide-react';
import { cn } from '../utils';

export type TabId = 'overview' | 'flights' | 'anomalies' | 'incidents' | 'atc' | 'query' | 'datasets';

const navItems: { id: TabId; label: string; icon: typeof Globe; shortLabel: string }[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'OVR', icon: Globe },
  { id: 'flights', label: 'Flights', shortLabel: 'FLT', icon: Plane },
  { id: 'anomalies', label: 'Anomalies', shortLabel: 'ANM', icon: AlertTriangle },
  { id: 'incidents', label: 'Incidents', shortLabel: 'INC', icon: FileText },
  { id: 'atc', label: 'ATC Feed', shortLabel: 'ATC', icon: Radio },
  { id: 'query', label: 'AI Query', shortLabel: 'AI', icon: MessageSquare },
  { id: 'datasets', label: 'Datasets', shortLabel: 'DAT', icon: Database },
];

export function Sidebar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={cn('sidebar fixed left-0 top-0 bottom-0 z-40 flex flex-col', expanded && 'expanded')}
      style={{
        background: 'linear-gradient(180deg, rgba(3, 7, 18, 0.97) 0%, rgba(6, 12, 24, 0.97) 100%)',
        borderRight: '1px solid rgba(0, 255, 200, 0.06)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-hud-border">
        <div className="relative flex-shrink-0">
          <Radar className="w-8 h-8 text-radar-400" />
          <div className="absolute inset-0 radar-ping">
            <Radar className="w-8 h-8 text-radar-400 opacity-20" />
          </div>
        </div>
        {expanded && (
          <div className="animate-fade-in overflow-hidden">
            <div className="text-sm font-display font-bold tracking-[0.2em] text-gradient whitespace-nowrap">
              AIRSENTINEL
            </div>
            <div className="text-[9px] font-mono text-gray-600 tracking-[0.15em] whitespace-nowrap">
              v1.0 // TACTICAL
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {navItems.map(({ id, label, shortLabel, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn('sidebar-item w-full', activeTab === id && 'active')}
            title={!expanded ? label : undefined}
          >
            <Icon className="sidebar-icon w-5 h-5 flex-shrink-0" />
            {expanded ? (
              <span className="text-sm font-medium whitespace-nowrap animate-fade-in">{label}</span>
            ) : (
              <span className="text-[9px] font-mono tracking-wider absolute left-[52px] opacity-0 group-hover:opacity-100">
                {shortLabel}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-center py-4 border-t border-hud-border text-gray-600 hover:text-radar-400 transition-colors"
      >
        {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </aside>
  );
}
