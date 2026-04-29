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
import { AboutModal } from './components/AboutModal';
import { DataSourceBadge, FreshnessStamp, type SourceState } from './components/StatusPrimitives';
import { useDashboardStats, useCapabilities } from './api/hooks';
import { cn } from './utils';

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
    <div className="hud-panel max-w-3xl p-8">
      <div className="space-y-3">
        <div className="h-5 w-40 rounded-md loading-shimmer" />
        <div className="h-24 rounded-xl loading-shimmer" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="h-32 rounded-xl loading-shimmer" />
          <div className="h-32 rounded-xl loading-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [aboutOpen, setAboutOpen] = useState(false);
  const { data: stats } = useDashboardStats({
    enabled: liveTabs.has(activeTab),
    refetchInterval: 30000,
  });
  const { data: capabilities, isError: capabilitiesError } = useCapabilities();

  const aiLive = capabilities?.ai_inference?.live;
  const showDemoBanner = aiLive === false;
  const aiSource: SourceState = capabilitiesError
    ? 'unavailable'
    : aiLive === undefined
      ? 'checking'
      : aiLive
        ? 'live'
        : 'demo';

  const ActivePage = pages[activeTab];

  return (
    <div className="relative z-10 flex min-h-screen">
      {showDemoBanner && (
        <div className="fixed left-0 right-0 top-0 z-50 border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-center font-mono text-[10px] text-yellow-500">
          DEMO MODE - AI features are using simulated responses. Set HUGGINGFACE_API_KEY for live analysis.
        </div>
      )}
      {aboutOpen && <AboutModal capabilities={capabilities} onClose={() => setAboutOpen(false)} />}

      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          startTransition(() => setActiveTab(tab));
        }}
      />

      <div
        className={cn(
          'ml-0 flex min-h-screen flex-1 flex-col pb-[72px] md:ml-[72px] md:pb-0',
          showDemoBanner && 'mt-8',
        )}
      >
        <Header onAboutOpen={() => setAboutOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-5" key={activeTab}>
          <Suspense fallback={<LoadingView />}>
            <ActivePage />
          </Suspense>
        </main>

        <footer className="border-t border-hud-border bg-void-900/50 px-5 py-3">
          <div className="flex flex-col gap-3 font-mono text-[10px] text-gray-700 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-gray-600">AIRSENTINEL AI v1.0</span>
              <span className="text-gray-800">|</span>
              <span>PUBLIC READ-ONLY DEMO</span>
              <span className="text-gray-800">|</span>
              <DataSourceBadge source={aiSource} label={aiSource === 'live' ? 'AI LIVE' : undefined} />
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-gray-700" />
              <FreshnessStamp timestamp={stats?.last_updated} fallback="Live on demand" />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
