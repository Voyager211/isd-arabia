import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

/**
 * Repeatable single-line inputs — the key-features list (PROJECT_PLAN.md §11.5).
 *
 * Reorder is arrow buttons rather than drag-and-drop: these are short text
 * rows, keyboard users get the same affordance as pointer users for free, and
 * the client enters the entire catalogue by hand so the keyboard path matters
 * more here than the pointer one.
 */
export function RepeatableList({
  label,
  values,
  onChange,
  placeholder,
  max = 50,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  const set = (index: number, value: string) =>
    onChange(values.map((entry, i) => (i === index ? value : entry)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= values.length) return;
    const next = [...values];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div>
      <p className="field-label">{label}</p>

      <ul className="space-y-2">
        {values.map((value, index) => (
          <li key={index} className="flex items-center gap-2">
            <input
              value={value}
              onChange={(event) => set(index, event.target.value)}
              placeholder={placeholder}
              aria-label={`${label} ${index + 1}`}
              className="field-input"
            />
            <div className="flex shrink-0">
              <button
                type="button"
                onClick={() => move(index, index - 1)}
                disabled={index === 0}
                aria-label={`Move ${label} ${index + 1} up`}
                className="rounded p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"
              >
                <ArrowUp aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, index + 1)}
                disabled={index === values.length - 1}
                aria-label={`Move ${label} ${index + 1} down`}
                className="rounded p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"
              >
                <ArrowDown aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                aria-label={`Remove ${label} ${index + 1}`}
                className="rounded p-1.5 text-text-muted hover:text-status-lost"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onChange([...values, ''])}
        disabled={values.length >= max}
        className="btn btn-ghost mt-2"
      >
        <Plus aria-hidden className="size-4" />
        Add
      </button>
    </div>
  );
}
