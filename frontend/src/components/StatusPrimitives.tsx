import type { ReactNode } from 'react';
import { AlertTriangle, Archive, Clock, Database, Info, Radio, ShieldCheck, Wifi, WifiOff, type LucideIcon } from 'lucide-react';
import { cn, formatRelativeTime } from '../utils';

export type SourceState = 'live' | 'archive' | 'asrs' | 'demo' | 'unavailable' | 'checking';

const sourceConfig: Record<SourceState, { label: string; className: string; icon: LucideIcon }> = {
  live: {
    label: 'LIVE',
    className: 'border-green-500/25 bg-green-500/10 text-green-400',
    icon: Wifi,
  },
  archive: {
    label: 'ARCHIVE',
    className: 'border-blue-500/25 bg-blue-500/10 text-blue-400',
    icon: Archive,
  },
  asrs: {
    label: 'ASRS',
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
    icon: Database,
  },
  demo: {
    label: 'DEMO',
    className: 'border-yellow-500/25 bg-yellow-500/10 text-yellow-400',
    icon: Radio,
  },
  unavailable: {
    label: 'UNAVAILABLE',
    className: 'border-gray-500/20 bg-gray-500/10 text-gray-500',
    icon: WifiOff,
  },
  checking: {
    label: 'CHECKING',
    className: 'border-radar-400/20 bg-radar-400/10 text-radar-400',
    icon: Clock,
  },
};

export function DataSourceBadge({
  source,
  label,
  className,
}: {
  source: SourceState;
  label?: string;
  className?: string;
}) {
  const config = sourceConfig[source];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.12em]',
        config.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label || config.label}
    </span>
  );
}

export function FreshnessStamp({
  timestamp,
  fallback = 'On demand',
}: {
  timestamp?: string | null;
  fallback?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-gray-600">
      <Clock className="h-3 w-3" />
      {timestamp ? formatRelativeTime(timestamp) : fallback}
    </span>
  );
}

export function EmptyState({
  icon: Icon = Info,
  title,
  message,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="hud-panel p-10 text-center">
      <Icon className="mx-auto mb-3 h-9 w-9 text-gray-700" />
      <div className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-gray-400">
        {title}
      </div>
      {message && <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-gray-600">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Unable to load data',
  message,
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="hud-panel border-red-500/20 bg-red-500/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
        <div>
          <div className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-red-300">
            {title}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            {message || 'The backend did not return this dataset. Try again after the service recovers.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SafetyNotice() {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-200/80">
      <div className="mb-1 flex items-center gap-1.5 font-display uppercase tracking-[0.14em] text-amber-300">
        <ShieldCheck className="h-3.5 w-3.5" />
        Advisory only
      </div>
      AirSentinel V1 is a public intelligence demo. It is not certified for operational aviation safety decisions.
    </div>
  );
}
