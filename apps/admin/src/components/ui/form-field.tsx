import type { ReactNode } from 'react';

/**
 * Form field wrapper.
 *
 * Exists so that the accessibility wiring is done once and correctly rather
 * than re-typed on every input: a real `<label htmlFor>`, `aria-invalid`, and
 * an error associated through `aria-describedby` so it is announced rather
 * than only shown (PROJECT_PLAN.md §5.5).
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Receives the ids to spread onto the control. */
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? (
          <span className="ms-1 text-status-lost" aria-hidden>
            *
          </span>
        ) : (
          <span className="ms-1 font-normal text-text-muted">(optional)</span>
        )}
      </label>

      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}

      {hint ? (
        <p id={hintId} className="mt-1 text-caption text-text-secondary">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
