'use client';

/**
 * Print trigger.
 *
 * A client leaf purely so `window.print()` is reachable — the confirmation
 * page around it stays a server component. This page is the customer's only
 * receipt, so being able to print it is a real requirement, not a nicety.
 */
export function PrintButton({ children }: { children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary">
      {children}
    </button>
  );
}
