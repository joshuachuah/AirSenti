import { useMemo, useState } from 'react';
import { AlertTriangle, FileText, Plus, Send, Database } from 'lucide-react';
import { IncidentCard } from '../components/IncidentCard';
import { useCreateIncident, useIncidents, useDatasetStatus, type Incident as IncidentType } from '../api/hooks';
import { FRONTEND_CONFIG } from '../config';
import { DataSourceBadge, EmptyState, ErrorState } from '../components/StatusPrimitives';

type IncidentDraft = {
  title: string;
  description: string;
  airport_icao: string;
  region: string;
  severity: IncidentType['severity'];
  source_url: string;
  categories: string;
};

const initialDraft: IncidentDraft = {
  title: '',
  description: '',
  airport_icao: '',
  region: '',
  severity: 'moderate',
  source_url: '',
  categories: '',
};

export function Incidents() {
  const { data: incidents, isLoading, isError, error } = useIncidents({ limit: 20 });
  const { data: datasetStatus } = useDatasetStatus();
  const createIncident = useCreateIncident();
  const [showReporter, setShowReporter] = useState(false);
  const [draft, setDraft] = useState<IncidentDraft>(initialDraft);

  const hasDraft = useMemo(
    () => draft.title.trim() && draft.description.trim(),
    [draft.description, draft.title]
  );

  return (
    <div className="space-y-5">
      <div className="hud-panel p-5">
        <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
          <h2 className="font-display font-bold text-base text-gray-200 tracking-wide">
            AVIATION INCIDENTS
          </h2>
          <DataSourceBadge source={datasetStatus?.historicalIncidents?.loaded ? 'asrs' : 'demo'} label={datasetStatus?.historicalIncidents?.loaded ? 'ASRS DATABASE' : 'DEMO DATA'} />
          <button
            className="btn-primary text-xs py-2 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!FRONTEND_CONFIG.publicWritesEnabled}
            title={
              FRONTEND_CONFIG.publicWritesEnabled
                ? 'Submit an incident report'
                : 'Public writes are disabled for this V1 demo'
            }
            onClick={() => {
              if (FRONTEND_CONFIG.publicWritesEnabled) setShowReporter(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            {FRONTEND_CONFIG.publicWritesEnabled ? 'Report Incident' : 'Read-Only Mode'}
          </button>
        </div>

        {!FRONTEND_CONFIG.publicWritesEnabled && (
          <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[11px] font-mono text-blue-300">
            Public incident submission is disabled. This deployment is browse-only until authenticated/admin writes are added.
          </div>
        )}

        {isError ? (
          <ErrorState
            title="Incidents unavailable"
            message={error instanceof Error ? error.message : 'The incidents endpoint did not respond.'}
          />
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-lg loading-shimmer" />
            ))}
          </div>
        ) : !incidents || incidents.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No incident records"
            message="No ASRS or demo incidents are available from the backend right now."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {incidents.map((incident: IncidentType, i: number) => (
              <div
                key={incident.id}
                className="opacity-0 animate-slide-up"
                style={{ animationDelay: `${Math.min(i * 0.04, 0.5)}s` }}
              >
                <IncidentCard incident={incident} />
              </div>
            ))}
          </div>
        )}
      </div>

      {showReporter && FRONTEND_CONFIG.publicWritesEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/75 px-4 backdrop-blur-sm">
          <div className="hud-panel w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="mb-1 flex items-center gap-2 text-radar-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-[11px] font-display uppercase tracking-[0.18em]">Incident Intake</span>
                </div>
                <h3 className="font-display text-xl font-bold text-gray-100">Submit an incident report</h3>
                <p className="mt-1 text-sm text-gray-500">
                  This now creates a persisted backend incident instead of leaving the button dormant.
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setShowReporter(false)}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="data-label">Title</span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
                  className="input-field"
                  placeholder="Runway incursion at KJFK"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="data-label">Description</span>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                  className="input-field min-h-32"
                  placeholder="Summarize what happened, who was involved, and what is known so far."
                />
              </label>

              <label className="space-y-2">
                <span className="data-label">Airport ICAO</span>
                <input
                  value={draft.airport_icao}
                  onChange={(e) => setDraft((current) => ({ ...current, airport_icao: e.target.value.toUpperCase() }))}
                  className="input-field"
                  placeholder="KJFK"
                  maxLength={4}
                />
              </label>

              <label className="space-y-2">
                <span className="data-label">Region</span>
                <input
                  value={draft.region}
                  onChange={(e) => setDraft((current) => ({ ...current, region: e.target.value }))}
                  className="input-field"
                  placeholder="New York"
                />
              </label>

              <label className="space-y-2">
                <span className="data-label">Severity</span>
                <select
                  value={draft.severity}
                  onChange={(e) => setDraft((current) => ({ ...current, severity: e.target.value as IncidentType['severity'] }))}
                  className="input-field"
                >
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="serious">Serious</option>
                  <option value="fatal">Fatal</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="data-label">Categories</span>
                <input
                  value={draft.categories}
                  onChange={(e) => setDraft((current) => ({ ...current, categories: e.target.value }))}
                  className="input-field"
                  placeholder="runway_incursion, low_visibility"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="data-label">Source URL</span>
                <input
                  value={draft.source_url}
                  onChange={(e) => setDraft((current) => ({ ...current, source_url: e.target.value }))}
                  className="input-field"
                  placeholder="https://faa.gov/report"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 border-t border-hud-border pt-4">
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                New reports appear in the incidents grid immediately after submit.
              </div>
              <button
                className="btn-primary text-xs py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!hasDraft || createIncident.isPending}
                onClick={() => {
                  createIncident.mutate(
                    {
                      title: draft.title.trim(),
                      description: draft.description.trim(),
                      severity: draft.severity,
                      source: 'user_report',
                      source_url: draft.source_url || undefined,
                      categories: draft.categories
                        .split(',')
                        .map((category) => category.trim())
                        .filter(Boolean),
                      location: draft.airport_icao || draft.region
                        ? {
                            airport_icao: draft.airport_icao || undefined,
                            region: draft.region || undefined,
                          }
                        : undefined,
                    },
                    {
                      onSuccess: () => {
                        setDraft(initialDraft);
                        setShowReporter(false);
                      },
                    }
                  );
                }}
              >
                <Send className="h-3.5 w-3.5" />
                {createIncident.isPending ? 'Submitting' : 'Submit incident'}
              </button>
            </div>
            {createIncident.isError && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-300">
                {createIncident.error instanceof Error ? createIncident.error.message : 'Incident submission failed.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
