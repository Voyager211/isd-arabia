import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Modal and slide-over primitive.
 *
 * Accessibility floor (PROJECT_PLAN.md §5.5): traps focus while open, restores
 * it to the trigger on close, and closes on Escape. Rendered through a portal
 * so a modal opened from inside a table cell is not clipped by an
 * `overflow: hidden` ancestor.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * 'center' for confirmations and detail views, 'end' for the record editors
   * that slide in from the inline-end edge (§11.4).
   */
  variant?: 'center' | 'end';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'center',
  size = 'md',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Focus the first control rather than the panel itself, so a keyboard user
    // lands on something actionable.
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panelRef.current)?.focus();

    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) return;

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return createPortal(
    <div className="fixed inset-0 z-70">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />

      <div
        className={
          variant === 'end'
            ? 'absolute inset-y-0 end-0 flex w-full sm:w-[min(92vw,520px)]'
            : 'absolute inset-0 flex items-center justify-center p-4'
        }
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`flex w-full flex-col bg-surface-page shadow-overlay outline-none ${
            variant === 'end'
              ? 'h-full'
              : `${SIZES[size]} max-h-[90dvh] rounded-[var(--radius-card)]`
          }`}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border-subtle px-4 py-3">
            <div>
              <h2 id={titleId} className="font-display text-h3 font-semibold text-surface-inverse">
                {title}
              </h2>
              {description ? (
                <p className="mt-0.5 text-caption text-text-secondary">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-me-1 rounded p-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

          {footer ? (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border-subtle px-4 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
