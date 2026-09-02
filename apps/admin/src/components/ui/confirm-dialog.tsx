import { Loader2 } from 'lucide-react';

import { Modal } from './modal';

/**
 * Confirmation for destructive actions.
 *
 * The confirm button is never the default focus — the modal focuses the first
 * control, which is Cancel. An Enter keypress landing on "Delete" is how
 * accidental deletions happen.
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  isDestructive = false,
  isBusy = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  isBusy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isBusy}
            className={`btn ${isDestructive ? 'bg-status-lost text-white hover:opacity-90' : 'btn-accent'}`}
          >
            {isBusy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-body-sm text-text-secondary">{message}</p>
    </Modal>
  );
}
