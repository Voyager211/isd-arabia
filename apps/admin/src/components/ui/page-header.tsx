import type { ReactNode } from 'react';

/**
 * Consistent screen heading. Every admin page has exactly one `h1`, per the
 * accessibility floor.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-h2 font-bold text-surface-inverse">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-[64ch] text-body-sm text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
