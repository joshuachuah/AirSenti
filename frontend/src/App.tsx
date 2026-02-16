import { useState } from 'react';
import { Clock } from 'lucide-react';
import { Sidebar, type TabId } from './components/Sidebar';
import { Header } from './components/Header';
import { Overview } from './pages/Overview';
import { Flights } from './pages/Flights';
import { Anomalies } from './pages/Anomalies';
import { Incidents } from './pages/Incidents';
import { ATC } from './pages/ATC';
import { Query } from './pages/Query';
import { Datasets } from './pages/Datasets';
import { useDashboardStats } from './api/hooks';
import { formatRelativeTime } from './utils';

const pages: Record<TabId, () => JSX.Element> = {
  overview: Overview,
  flights: Flights,
  anomalies: Anomalies,
  incidents: Incidents,
  atc: ATC,
  query: Query,
  datasets: Datasets,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { data: stats } = useDashboardStats();

  const ActivePage = pages[activeTab];

  return (
    <div className="relative z-10 min-h-screen flex">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main area */}
      <div className="flex-1 ml-[72px] flex flex-col min-h-screen">
        <Header />

        {/* Content */}
        <main className="flex-1 p-5 overflow-y-auto" key={activeTab}>
          <ActivePage />
        </main>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-hud-border bg-void-900/50">
          <div className="flex items-center justify-between text-[10px] font-mono text-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-gray-600">AIRSENTINEL AI v1.0</span>
              <span className="text-gray-800">|</span>
              <span>DATA: OPENSKY NETWORK</span>
              <span className="text-gray-800">|</span>
              <span>AI: HUGGING FACE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>
                {stats?.last_updated ? formatRelativeTime(stats.last_updated) : '—'}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
