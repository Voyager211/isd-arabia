import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

import type { ProductSpecification } from '@isd/shared-types';

/** Repeatable label/value pairs — the specifications table (§11.5). */
export function SpecList({
  values,
  onChange,
  max = 100,
}: {
  values: ProductSpecification[];
  onChange: (values: ProductSpecification[]) => void;
  max?: number;
}) {
  const set = (index: number, patch: Partial<ProductSpecification>) =>
    onChange(values.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= values.length) return;
    const next = [...values];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div>
      <p className="field-label">Specifications</p>

      <ul className="space-y-2">
        {values.map((spec, index) => (
          <li key={index} className="flex items-center gap-2">
            <input
              value={spec.label}
              onChange={(event) => set(index, { label: event.target.value })}
              placeholder="Material"
              aria-label={`Specification ${index + 1} label`}
              className="field-input w-1/3"
            />
            <input
              value={spec.value}
              onChange={(event) => set(index, { value: event.target.value })}
              placeholder="Copper-coated steel"
              aria-label={`Specification ${index + 1} value`}
              className="field-input"
            />
            <div className="flex shrink-0">
              <button
                type="button"
                onClick={() => move(index, index - 1)}
                disabled={index === 0}
                aria-label={`Move specification ${index + 1} up`}
                className="rounded p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"
              >
                <ArrowUp aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, index + 1)}
                disabled={index === values.length - 1}
                aria-label={`Move specification ${index + 1} down`}
                className="rounded p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"
              >
                <ArrowDown aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                aria-label={`Remove specification ${index + 1}`}
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
        onClick={() => onChange([...values, { label: '', value: '' }])}
        disabled={values.length >= max}
        className="btn btn-ghost mt-2"
      >
        <Plus aria-hidden className="size-4" />
        Add specification
      </button>
    </div>
  );
}
