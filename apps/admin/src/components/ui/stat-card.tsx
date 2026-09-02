import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption font-semibold text-text-secondary">{label}</p>
        <Icon aria-hidden className="size-4 shrink-0 text-text-muted" />
      </div>
      <p className="mt-2 font-display text-h1 font-bold text-surface-inverse" data-tabular>
        {typeof value === 'number' ? value.toLocaleString('en') : value}
      </p>
      {hint ? <p className="mt-1 text-caption text-text-secondary">{hint}</p> : null}
    </div>
  );
}
