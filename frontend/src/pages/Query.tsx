import { MessageSquare } from 'lucide-react';
import { QueryPanel } from '../components/QueryPanel';

export function Query() {
  return (
    <div className="space-y-5">
      <div className="hud-panel p-5 opacity-0 animate-slide-up stagger-1">
        <div className="mb-5">
          <h2 className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-radar-400" />
            <span className="font-display font-bold text-base text-gray-200 tracking-wide">
              AI-POWERED QUERY
            </span>
          </h2>
          <p className="text-sm text-gray-500">
            Ask natural language questions about flights, incidents, airspace activity, and more.
          </p>
        </div>
        <QueryPanel />
      </div>
    </div>
  );
}
