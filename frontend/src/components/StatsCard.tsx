import { cn, formatCompact } from '../utils';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

type CardColor = 'radar' | 'amber' | 'red' | 'blue';

const colorMap: Record<CardColor, { icon: string; accent: string }> = {
  radar: {
    icon: 'text-radar-400 bg-radar-400/10 border-radar-400/20',
    accent: 'text-radar-400',
  },
  amber: {
    icon: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    accent: 'text-amber-400',
  },
  red: {
    icon: 'text-red-400 bg-red-400/10 border-red-400/20',
    accent: 'text-red-400',
  },
  blue: {
    icon: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    accent: 'text-blue-400',
  },
};

export function StatsCard({
  icon: Icon,
  label,
  value,
  trend,
  color = 'radar',
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: string;
  color?: CardColor;
  className?: string;
}) {
  const colors = colorMap[color];
  const isNegative = trend?.startsWith('-');

  return (
    <div className={cn('stat-card group', className)}>
      {/* Corner accent line */}
      <div
        className="absolute top-0 right-0 w-12 h-12 pointer-events-none opacity-30"
        style={{
          background: `linear-gradient(225deg, ${color === 'radar' ? 'rgba(0,255,200,0.15)' : color === 'amber' ? 'rgba(245,158,11,0.15)' : color === 'red' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)'} 0%, transparent 60%)`,
        }}
      />

      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-lg border', colors.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-mono',
              isNegative ? 'text-red-400' : 'text-green-400',
            )}
          >
            {isNegative ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
            <span>{trend}</span>
          </div>
        )}
      </div>

      <div className="data-value mb-1">{typeof value === 'number' ? formatCompact(value) : value}</div>
      <div className="data-label">{label}</div>
    </div>
  );
}
