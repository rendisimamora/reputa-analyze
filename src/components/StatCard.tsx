import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { HelpTooltip } from './Tooltip';

export function StatCard({
  label,
  value,
  hint,
  Icon,
  tone = 'default',
  tooltip,
}: {
  label: string;
  value: string | number;
  hint?: string;
  Icon?: LucideIcon;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  tooltip?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-ink-300">
        <div className="text-xs uppercase tracking-wider flex items-center gap-1.5">
          {label}
          {tooltip && <HelpTooltip text={tooltip} />}
        </div>
        {Icon && <Icon size={16} className="text-ink-400" />}
      </div>
      <div
        className={clsx(
          'mt-2 text-2xl font-semibold tracking-tight',
          tone === 'good' && 'text-success-500',
          tone === 'warn' && 'text-warning-500',
          tone === 'bad' && 'text-danger-500',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
    </div>
  );
}
