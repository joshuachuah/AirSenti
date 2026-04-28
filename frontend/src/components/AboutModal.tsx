import { AlertTriangle, Database, Radio, Satellite, Sparkles, X } from 'lucide-react';
import type { SourceState } from './StatusPrimitives';
import { DataSourceBadge, SafetyNotice } from './StatusPrimitives';

type CapabilityMap = Record<string, { live: boolean; source: string }>;

function capabilityToSource(capability?: { live: boolean; source: string }): SourceState {
  if (!capability) return 'checking';
  if (capability.source === 'asrs') return 'asrs';
  if (capability.source === 'archive') return 'archive';
  if (capability.source === 'demo' || capability.source === 'mock') return 'demo';
  if (capability.source === 'unavailable') return 'unavailable';
  return capability.live ? 'live' : 'unavailable';
}

export function AboutModal({
  capabilities,
  onClose,
}: {
  capabilities?: CapabilityMap;
  onClose: () => void;
}) {
  const rows = [
    {
      icon: Satellite,
      title: 'OpenSky flight tracking',
      body: 'Live aircraft state vectors are shown when OpenSky is reachable. If the feed is down or empty, panels display unavailable states instead of treating stale data as live.',
      source: capabilityToSource(capabilities?.flights),
    },
    {
      icon: Database,
      title: 'ASRS incident archive',
      body: 'Safety reports and similar-incident lookup come from archive datasets. These are historical reports, not live emergency notifications.',
      source: capabilityToSource(capabilities?.incidents),
    },
    {
      icon: Radio,
      title: 'ATC transcripts',
      body: 'V1 uses available archived transcript data unless a live integration is added later. Archive and demo states are labeled in the interface.',
      source: capabilityToSource(capabilities?.atc),
    },
    {
      icon: Sparkles,
      title: 'AI assistance',
      body: 'Image analysis, anomaly explanations, and natural-language query responses are advisory. Without a Hugging Face key, the backend reports demo mode.',
      source: capabilityToSource(capabilities?.ai_inference),
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void-950/80 px-4 backdrop-blur-md">
      <div className="hud-panel max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6 shadow-panel">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-radar-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-[11px] font-display uppercase tracking-[0.18em]">
                Public V1 boundaries
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-gray-100">About AirSentinel V1</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
              AirSentinel is a read-only aviation intelligence demo that makes source mode and data freshness visible.
            </p>
          </div>
          <button className="btn-ghost p-2" onClick={onClose} aria-label="Close about dialog">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5">
          <SafetyNotice />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map(({ icon: Icon, title, body, source }) => (
            <div key={title} className="rounded-lg border border-hud-border bg-void-850/50 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-radar-400" />
                  <h3 className="font-display text-sm font-semibold text-gray-200">{title}</h3>
                </div>
                <DataSourceBadge source={source} />
              </div>
              <p className="text-sm leading-relaxed text-gray-500">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-hud-border bg-white/[0.02] p-4">
          <div className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.12em] text-gray-300">
            Public write policy
          </div>
          <p className="text-sm leading-relaxed text-gray-500">
            Public incident submissions are disabled unless the deployment explicitly enables public writes. This keeps V1 useful to share while avoiding an unauthenticated write surface.
          </p>
        </div>
      </div>
    </div>
  );
}
