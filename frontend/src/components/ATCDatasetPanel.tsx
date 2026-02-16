import { useState } from 'react';
import { Radio, Search, ChevronLeft } from 'lucide-react';
import { formatCompact } from '../utils';
import { useATCDataset, useATCDatasetSearch, type ATCDatasetEntry } from '../api/hooks';

export function ATCDatasetPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const { data: browseData, isLoading: browseLoading } = useATCDataset({ limit: 20 });
  const { data: searchData, isLoading: searchLoading } = useATCDatasetSearch(activeSearch);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
  };

  const data = activeSearch ? searchData : browseData;
  const isLoading = activeSearch ? searchLoading : browseLoading;
  const entries = data?.entries || [];

  return (
    <div className="hud-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-blue-400" />
          <span className="font-display font-bold text-base text-gray-200 tracking-wide">
            ATC Transcripts
          </span>
        </h2>
        <div className="text-xs font-mono text-gray-600">
          {data?.total ? `${formatCompact(data.total)} entries` : ''}
        </div>
      </div>

      <form onSubmit={handleSearch} className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transcripts (e.g., cleared for takeoff, go around)..."
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg loading-shimmer" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-gray-600 text-center py-12 text-sm">
          {activeSearch ? `No results for "${activeSearch}"` : 'No ATC transcripts available'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {entries.map((entry: ATCDatasetEntry) => (
            <div
              key={entry.id}
              className="p-3 rounded-lg bg-void-850/50 border border-hud-border hover:border-hud-border-active transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="badge text-[10px] py-0.5 px-2 bg-blue-500/10 text-blue-400 border-blue-500/20">
                  ATC
                </span>
                <span className="text-[10px] text-gray-700 font-mono">{entry.id}</span>
              </div>
              <p className="text-sm text-gray-400 font-mono leading-relaxed">{entry.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
