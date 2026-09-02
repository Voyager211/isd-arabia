import type { DashboardStats } from '@isd/shared-types';

/**
 * Quotations per week over the last eight weeks (PROJECT_PLAN.md §11.3).
 *
 * Plain divs, not a charting library. Eight bars with one series does not
 * justify ~50 kB of JavaScript in an admin bundle, and a div-based bar chart
 * is trivially accessible — the underlying figures live in a real table that
 * is visually hidden but read normally by a screen reader, which no canvas
 * chart manages without extra work.
 */
export function QuotationChart({ weeks }: { weeks: DashboardStats['quotationsPerWeek'] }) {
  // A floor of 1 keeps the bars from dividing by zero on a quiet fortnight.
  const max = Math.max(1, ...weeks.map((week) => week.count));

  const formatWeek = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  return (
    <div className="panel p-4">
      <h2 className="font-display text-h3 font-semibold text-surface-inverse">
        Quotations per week
      </h2>
      <p className="text-caption text-text-secondary">Last 8 weeks</p>

      <div aria-hidden className="mt-4 flex h-40 items-end gap-2">
        {weeks.map((week) => (
          <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-caption text-text-secondary" data-tabular>
              {week.count}
            </span>
            <div
              className="w-full rounded-t-[2px] bg-action-secondary/80 transition-[height]"
              style={{
                // A visible sliver at zero, so an empty week reads as a week
                // with none rather than as missing data.
                height: `${Math.max(2, (week.count / max) * 100)}%`,
              }}
            />
            <span className="text-caption text-text-muted">{formatWeek(week.weekStart)}</span>
          </div>
        ))}
      </div>

      {/* The same figures, as a real table, for assistive technology. */}
      <table className="sr-only">
        <caption>Quotations received per week over the last eight weeks</caption>
        <thead>
          <tr>
            <th scope="col">Week beginning</th>
            <th scope="col">Quotations</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <th scope="row">{formatWeek(week.weekStart)}</th>
              <td>{week.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
