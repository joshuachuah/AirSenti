import { useState } from 'react';
import { FileText, Search, ChevronLeft, ChevronRight, Plane, MapPin } from 'lucide-react';
import { cn, formatNumber } from '../utils';
import { useHistoricalIncidents, useHistoricalIncidentSearch, type HistoricalIncident } from '../api/hooks';

function HistoricalIncidentCard({ incident }: { incident: HistoricalIncident }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="hud-panel p-4 hover:border-hud-border-active transition-all duration-300">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {incident.primaryProblem && (
            <span className="badge badge-medium text-[10px] py-0.5 px-2">
              {incident.primaryProblem}
            </span>
          )}
          {incident.flightPhase && (
            <span className="badge text-[10px] py-0.5 px-2 bg-blue-500/10 text-blue-400 border-blue-500/20">
              {incident.flightPhase}
            </span>
          )}
        </div>
        <div className="text-[10px] text-gray-600 font-mono shrink-0 ml-2">
          {incident.date || 'N/A'} | ACN {incident.acnNumber}
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-2 leading-relaxed">
        {incident.synopsis || incident.narrative.slice(0, 200)}
      </p>

      <div className="flex items-center gap-4 text-[11px] text-gray-600 mb-2">
        {incident.aircraftMakeModel && (
          <span className="flex items-center gap-1">
            <Plane className="w-3 h-3" /> {incident.aircraftMakeModel}
          </span>
        )}
        {incident.localeReference && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {incident.localeReference}
          </span>
        )}
        {incident.aircraftOperator && <span>{incident.aircraftOperator}</span>}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-hud-border text-sm text-gray-500 space-y-2">
          <p>
            <strong className="text-gray-400 font-sans">Narrative:</strong> {incident.narrative}
          </p>
          {incident.contributingFactors && (
            <p>
              <strong className="text-gray-400 font-sans">Contributing Factors:</strong>{' '}
              {incident.contributingFactors}
            </p>
          )}
          {incident.anomaly && (
            <p>
              <strong className="text-gray-400 font-sans">Anomaly:</strong> {incident.anomaly}
            </p>
          )}
          {incident.result && (
            <p>
              <strong className="text-gray-400 font-sans">Result:</strong> {incident.result}
            </p>
          )}
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex items-center gap-1 text-[11px] font-display font-medium text-radar-500 hover:text-radar-400 transition-colors"
      >
        {expanded ? 'Show Less' : 'Full Report'}
        <ChevronRight
          className={cn('w-3 h-3 transition-transform duration-200', expanded && 'rotate-90')}
        />
      </button>
    </div>
  );
}

export function HistoricalPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const { data: browseData, isLoading: browseLoading } = useHistoricalIncidents({
    offset: page * pageSize,
    limit: pageSize,
  });

  const { data: searchData, isLoading: searchLoading } = useHistoricalIncidentSearch(activeSearch, {
    offset: 0,
    limit: 20,
    enabled: !!activeSearch,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
    setPage(0);
  };

  const data = activeSearch ? searchData : browseData;
  const isLoading = activeSearch ? searchLoading : browseLoading;
  const incidents = data?.incidents || [];

  return (
    <div className="hud-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          <span className="font-display font-bold text-base text-gray-200 tracking-wide">
            ASRS Safety Reports
          </span>
        </h2>
        <div className="text-xs font-mono text-gray-600">
          {data?.total ? `${formatNumber(data.total)} reports` : ''}
        </div>
      </div>

      <form onSubmit={handleSearch} className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search incidents (e.g., runway incursion, engine failure)..."
          className="input-field pl-11 pr-24 py-2.5 text-sm"
        />
        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary text-xs py-1.5 px-3">
          Search
        </button>
      </form>

      {activeSearch && (
        <button
          onClick={() => {
            setActiveSearch('');
            setSearchQuery('');
          }}
          className="mb-4 text-xs text-radar-500 hover:text-radar-400 flex items-center gap-1 font-display"
        >
          <ChevronLeft className="w-3 h-3" /> Clear search
        </button>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg loading-shimmer" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="text-gray-600 text-center py-12 text-sm">
          {activeSearch ? `No results for "${activeSearch}"` : 'No historical incidents loaded'}
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map((incident: HistoricalIncident) => (
            <HistoricalIncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
      )}

      {!activeSearch && data && data.hasMore && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-hud-border">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs font-display text-radar-500 hover:text-radar-400 disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-xs font-mono text-gray-600">Page {page + 1}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!data.hasMore}
            className="text-xs font-display text-radar-500 hover:text-radar-400 disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
