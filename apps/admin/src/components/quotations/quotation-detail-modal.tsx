import { useState } from 'react';
import { Copy, Loader2, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';

import type { Quotation, QuotationStatus } from '@isd/shared-types';
import { QUOTATION_STATUS_TRANSITIONS } from '@isd/shared-types';

import { normaliseError, patch, post } from '@/lib/api-client';
import { useAsyncData } from '@/hooks/use-async-data';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/status-badge';

/**
 * Quotation detail (PROJECT_PLAN.md §11.6).
 *
 * Everything the team needs to act on a request without leaving the table:
 * the customer block with click-to-call and click-to-email, a copyable
 * address, the line items, the status control and the internal note thread.
 *
 * The items render from the SNAPSHOT stored on the quotation, not from a
 * lookup — which is why a quotation for a since-deleted product still shows
 * exactly what was requested (acceptance criterion #27).
 */

const STATUS_LABELS: Record<QuotationStatus, string> = {
  new: 'New',
  in_review: 'In review',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
  cancelled: 'Cancelled',
};

export function QuotationDetailModal({
  quotationId,
  onClose,
  onChanged,
}: {
  quotationId: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const { data, isLoading, error, setData } = useAsyncData<Quotation>(
    `/admin/quotations/${quotationId}`,
  );

  const [nextStatus, setNextStatus] = useState<QuotationStatus | ''>('');
  const [statusNote, setStatusNote] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const allowedTransitions = data ? QUOTATION_STATUS_TRANSITIONS[data.status] : [];

  const onChangeStatus = async () => {
    if (!nextStatus) return;

    setIsBusy(true);
    try {
      const updated = await patch<Quotation>(`/admin/quotations/${quotationId}/status`, {
        status: nextStatus,
        note: statusNote.trim() || undefined,
      });
      setData(updated);
      setNextStatus('');
      setStatusNote('');
      toast.success(`Moved to ${STATUS_LABELS[updated.status]}.`);
      await onChanged();
    } catch (caught) {
      toast.error(normaliseError(caught).message);
    } finally {
      setIsBusy(false);
    }
  };

  const onAddNote = async () => {
    if (!newNote.trim()) return;

    setIsBusy(true);
    try {
      const updated = await post<Quotation>(`/admin/quotations/${quotationId}/notes`, {
        note: newNote,
      });
      setData(updated);
      setNewNote('');
      toast.success('Note added.');
    } catch (caught) {
      toast.error(normaliseError(caught).message);
    } finally {
      setIsBusy(false);
    }
  };

  const copyAddress = async () => {
    if (!data) return;

    const address = [
      data.customer.company,
      data.address.line1,
      data.address.line2,
      `${data.address.city}, ${data.address.region}`,
      data.address.postalCode,
      data.address.country,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied.');
    } catch {
      // The clipboard API needs a secure context and a user gesture; both hold
      // here, but a browser policy can still refuse.
      toast.error('Could not copy. Select the address and copy it manually.');
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      title={data ? `Quotation ${data.quoteNumber}` : 'Quotation'}
      description={
        data
          ? `Received ${new Date(data.createdAt).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : undefined
      }
      footer={
        <button type="button" onClick={onClose} className="btn btn-ghost">
          Close
        </button>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-text-secondary">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p role="alert" className="text-body-sm text-status-lost">
          {error}
        </p>
      ) : data ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <StatusBadge status={data.status} />
            <span className="text-caption text-text-secondary" data-tabular>
              {data.items.reduce((total, item) => total + item.quantity, 0)} items
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <h3 className="mb-2 font-display text-h3 font-semibold text-surface-inverse">
                Customer
              </h3>
              <dl className="space-y-1 text-body-sm">
                <Row label="Company" value={data.customer.company} />
                <Row label="Contact" value={data.customer.name} />
                {data.customer.designation ? (
                  <Row label="Job title" value={data.customer.designation} />
                ) : null}
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-text-secondary">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${data.customer.email}?subject=${encodeURIComponent(
                        `Your quotation ${data.quoteNumber}`,
                      )}`}
                      className="inline-flex items-center gap-1.5 text-action-secondary hover:underline"
                    >
                      <Mail aria-hidden className="size-3.5" />
                      {data.customer.email}
                    </a>
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-text-secondary">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${data.customer.phone.replace(/\s/g, '')}`}
                      className="inline-flex items-center gap-1.5 text-action-secondary hover:underline"
                    >
                      <Phone aria-hidden className="size-3.5" />
                      {data.customer.phone}
                    </a>
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-h3 font-semibold text-surface-inverse">
                  Delivery address
                </h3>
                <button
                  type="button"
                  onClick={() => void copyAddress()}
                  className="inline-flex items-center gap-1 text-caption text-action-secondary hover:underline"
                >
                  <Copy aria-hidden className="size-3.5" />
                  Copy
                </button>
              </div>
              <address className="text-body-sm text-text-primary not-italic">
                {data.address.line1}
                <br />
                {data.address.line2 ? (
                  <>
                    {data.address.line2}
                    <br />
                  </>
                ) : null}
                {data.address.city}, {data.address.region}
                <br />
                {data.address.postalCode ? (
                  <>
                    {data.address.postalCode}
                    <br />
                  </>
                ) : null}
                {data.address.country}
              </address>
            </section>
          </div>

          <section>
            <h3 className="mb-2 font-display text-h3 font-semibold text-surface-inverse">Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-body-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-raised">
                    <th
                      scope="col"
                      className="px-2 py-2 text-start text-caption text-text-secondary"
                    >
                      Product
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 text-start text-caption text-text-secondary"
                    >
                      Part number
                    </th>
                    <th scope="col" className="px-2 py-2 text-end text-caption text-text-secondary">
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 text-start text-caption text-text-secondary"
                    >
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, index) => (
                    <tr key={`${item.sku}-${index}`} className="border-b border-border-subtle">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              width={32}
                              height={32}
                              className="size-8 rounded border border-border-subtle bg-white object-contain"
                            />
                          ) : null}
                          {item.name}
                        </div>
                      </td>
                      <td className="px-2 py-2" data-tabular>
                        {item.sku}
                      </td>
                      <td className="px-2 py-2 text-end" data-tabular>
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-2 py-2 text-text-secondary">{item.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {data.message ? (
            <section>
              <h3 className="mb-2 font-display text-h3 font-semibold text-surface-inverse">
                Customer message
              </h3>
              <p className="whitespace-pre-wrap rounded-[var(--radius-control)] bg-surface-raised p-3 text-body-sm text-text-primary">
                {data.message}
              </p>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 font-display text-h3 font-semibold text-surface-inverse">
              Change status
            </h3>

            {allowedTransitions.length ? (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="field-label" htmlFor="next-status">
                    Move to
                  </label>
                  <select
                    id="next-status"
                    value={nextStatus}
                    onChange={(event) => setNextStatus(event.target.value as QuotationStatus)}
                    className="field-input"
                  >
                    <option value="">— Choose —</option>
                    {allowedTransitions.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-48 flex-1">
                  <label className="field-label" htmlFor="status-note">
                    Note (optional)
                  </label>
                  <input
                    id="status-note"
                    value={statusNote}
                    onChange={(event) => setStatusNote(event.target.value)}
                    placeholder="Recorded against this change"
                    className="field-input"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void onChangeStatus()}
                  disabled={!nextStatus || isBusy}
                  className="btn btn-accent"
                >
                  Apply
                </button>
              </div>
            ) : (
              <p className="text-body-sm text-text-secondary">
                This quotation is closed. No further status changes are available.
              </p>
            )}

            {data.statusHistory.length ? (
              <ol className="mt-4 space-y-2 border-s border-border-subtle ps-4">
                {data.statusHistory.map((entry, index) => (
                  <li key={index} className="text-caption text-text-secondary">
                    <span className="text-text-primary">
                      {STATUS_LABELS[entry.from]} → {STATUS_LABELS[entry.to]}
                    </span>
                    {' · '}
                    {entry.changedByName ?? 'Admin'}
                    {' · '}
                    {new Date(entry.changedAt).toLocaleString('en-GB')}
                    {entry.note ? <div className="mt-0.5">{entry.note}</div> : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </section>

          <section>
            <h3 className="mb-2 font-display text-h3 font-semibold text-surface-inverse">
              Internal notes
            </h3>

            {data.adminNotes.length ? (
              <ul className="mb-3 space-y-2">
                {data.adminNotes.map((note, index) => (
                  <li
                    key={index}
                    className="rounded-[var(--radius-control)] bg-surface-raised p-3 text-body-sm"
                  >
                    <p className="whitespace-pre-wrap text-text-primary">{note.note}</p>
                    <p className="mt-1 text-caption text-text-secondary">
                      {note.addedByName ?? 'Admin'} ·{' '}
                      {new Date(note.addedAt).toLocaleString('en-GB')}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-body-sm text-text-secondary">No notes yet.</p>
            )}

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="field-label" htmlFor="new-note">
                  Add a note
                </label>
                <textarea
                  id="new-note"
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  rows={2}
                  placeholder="Visible to your team only"
                  className="field-input"
                />
              </div>
              <button
                type="button"
                onClick={() => void onAddNote()}
                disabled={!newNote.trim() || isBusy}
                className="btn btn-ghost"
              >
                Add
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-text-secondary">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  );
}
