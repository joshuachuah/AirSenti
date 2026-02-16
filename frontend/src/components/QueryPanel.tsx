import { useState } from 'react';
import { Search, MessageSquare, Sparkles, ArrowRight } from 'lucide-react';
import { useNaturalQuery } from '../api/hooks';

const SUGGESTIONS = [
  'Show all emergency flights',
  'Recent incidents near LAX',
  'Holding patterns today',
  'Aviation safety summary',
];

export function QueryPanel() {
  const [query, setQuery] = useState('');
  const naturalQuery = useNaturalQuery();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      naturalQuery.mutate(query);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search input */}
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about flights, incidents, or aviation data..."
          className="input-field pl-12 pr-28 py-3.5"
        />
        <button
          type="submit"
          disabled={naturalQuery.isPending || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary text-xs py-2 px-4 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {naturalQuery.isPending ? (
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 animate-pulse" />
              Analyzing
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              Ask AI
              <ArrowRight className="w-3 h-3" />
            </span>
          )}
        </button>
      </form>

      {/* AI Response */}
      {naturalQuery.data && (
        <div className="hud-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-radar-400/10 border border-radar-400/20">
              <MessageSquare className="w-4 h-4 text-radar-400" />
            </div>
            <span className="text-sm font-display font-semibold text-radar-400 tracking-wide">
              AI Response
            </span>
            <span className="text-[10px] font-mono text-gray-600 ml-auto">
              {naturalQuery.data.interpreted_intent}
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{naturalQuery.data.response}</p>
          {naturalQuery.data.suggested_followups && naturalQuery.data.suggested_followups.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {naturalQuery.data.suggested_followups.map((followup: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setQuery(followup)}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-hud-border text-gray-400
                             hover:text-radar-400 hover:border-radar-400/20 hover:bg-radar-400/5
                             transition-all duration-200"
                >
                  {followup}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Suggestion chips */}
      <div className="grid grid-cols-2 gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setQuery(suggestion)}
            className="text-left text-sm p-3.5 rounded-lg
                       bg-void-850/40 border border-hud-border
                       text-gray-500 hover:text-gray-300
                       hover:border-hud-border-active hover:bg-void-800/50
                       transition-all duration-200"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
