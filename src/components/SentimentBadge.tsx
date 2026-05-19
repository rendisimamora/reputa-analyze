import { clsx } from 'clsx';

export function SentimentBadge({ value }: { value: string | null | undefined }) {
  const v = (value ?? 'PENDING').toUpperCase();
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border',
        v === 'POSITIVE' && 'border-success-600/40 bg-success-500/10 text-success-500',
        v === 'NEGATIVE' && 'border-danger-600/40 bg-danger-500/10 text-danger-500',
        v === 'NEUTRAL' && 'border-ink-600/50 bg-ink-700/40 text-ink-200',
        v === 'PENDING' && 'border-ink-700 bg-ink-800/50 text-ink-400',
      )}
    >
      {v.toLowerCase()}
    </span>
  );
}

export function CrawlStatusBadge({ value }: { value: string | null | undefined }) {
  const v = (value ?? 'OK').toUpperCase();
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border',
        v === 'OK' && 'border-success-600/30 bg-success-500/10 text-success-500',
        v === 'PARTIAL' && 'border-warning-600/30 bg-warning-500/10 text-warning-500',
        v === 'RESTRICTED' && 'border-danger-600/30 bg-danger-500/10 text-danger-500',
        v === 'RATE_LIMITED' && 'border-warning-600/30 bg-warning-500/10 text-warning-500',
        v === 'ERROR' && 'border-danger-600/30 bg-danger-500/10 text-danger-500',
      )}
    >
      {v.replace('_', ' ').toLowerCase()}
    </span>
  );
}
