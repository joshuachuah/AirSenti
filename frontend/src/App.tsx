import {
  Suspense,
  lazy,
  startTransition,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';
import { Clock } from 'lucide-react';
import { Sidebar, type TabId } from './components/Sidebar';
import { Header } from './components/Header';
import { useDashboardStats, useCapabilities } from './api/hooks';
import { cn, formatRelativeTime } from './utils';

const Overview = lazy(async () => ({ default: (await import('./pages/Overview')).Overview }));
const Flights = lazy(async () => ({ default: (await import('./pages/Flights')).Flights }));
const Anomalies = lazy(async () => ({ default: (await import('./pages/Anomalies')).Anomalies }));
const Incidents = lazy(async () => ({ default: (await import('./pages/Incidents')).Incidents }));
const Imagery = lazy(async () => ({ default: (await import('./pages/Imagery')).Imagery }));
const ATC = lazy(async () => ({ default: (await import('./pages/ATC')).ATC }));
const Query = lazy(async () => ({ default: (await import('./pages/Query')).Query }));
const Datasets = lazy(async () => ({ default: (await import('./pages/Datasets')).Datasets }));

type PageComponent = LazyExoticComponent<ComponentType>;

const pages: Record<TabId, PageComponent> = {
  overview: Overview,
  flights: Flights,
  anomalies: Anomalies,
  incidents: Incidents,
  imagery: Imagery,
  atc: ATC,
  query: Query,
  datasets: Datasets,
};

const liveTabs = new Set<TabId>(['overview', 'flights', 'anomalies', 'atc']);

function LoadingView() {
  return (
    <div className="hud-panel p-8 max-w-3xl">
      <div className="space-y-3">
        <div className="h-5 w-40 rounded-md loading-shimmer" />
        <div className="h-24 rounded-xl loading-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="h-32 rounded-xl loading-shimmer" />
          <div className="h-32 rounded-xl loading-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { data: stats } = useDashboardStats({
    enabled: liveTabs.has(activeTab),
    refetchInterval: 30000,
  });
  const { data: capabilities } = useCapabilities();

  const aiLive = capabilities?.ai_inference?.live ?? false;

  const ActivePage = pages[activeTab];

  return (
    <div className="relative z-10 min-h-screen flex">
      {!aiLive && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-1.5 text-center text-[10px] font-mono text-yellow-500">
          ⚠️ DEMO MODE — AI features using simulated responses. Set HUGGINGFACE_API_KEY for live analysis.
        </div>
      )}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          startTransition(() => setActiveTab(tab));
        }}
      />

      <div className={cn('flex-1 ml-[72px] flex flex-col min-h-screen', !aiLive && 'mt-8')}>
        <Header />

        <main className="flex-1 p-5 overflow-y-auto" key={activeTab}>
          <Suspense fallback={<LoadingView />}>
            <ActivePage />
          </Suspense>
        </main>

        <footer className="px-5 py-3 border-t border-hud-border bg-void-900/50">
          <div className="flex items-center justify-between text-[10px] font-mono text-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-gray-600">AIRSENTINEL AI v1.0</span>
              <span className="text-gray-800">|</span>
              <span>DATA: OPENSKY NETWORK</span>
              <span className="text-gray-800">|</span>
              <span>AI: {aiLive ? 'HUGGING FACE' : 'DEMO MODE'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>{stats?.last_updated ? formatRelativeTime(stats.last_updated) : 'Live on demand'}</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}