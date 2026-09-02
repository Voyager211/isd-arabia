import { Construction } from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';

/**
 * Stub for a screen that lands in a later phase.
 *
 * Kept deliberately plain: it exists so the shell, navigation and guards are
 * exercisable end to end from Phase 1, not to suggest a design.
 */
export function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="panel flex items-center gap-3 p-6">
        <Construction aria-hidden className="size-5 shrink-0 text-text-muted" />
        <p className="text-body-sm text-text-secondary">
          The {title.toLowerCase()} screen is scheduled for {phase}.
        </p>
      </div>
    </>
  );
}
