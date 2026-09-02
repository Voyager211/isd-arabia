import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-surface-sunken p-4 text-center">
      <p className="font-display text-h1 font-bold text-surface-inverse">Page not found</p>
      <p className="max-w-[40ch] text-body-sm text-text-secondary">
        That screen does not exist. It may have been renamed or removed.
      </p>
      <Link to="/" className="btn btn-ghost mt-2">
        Back to the dashboard
      </Link>
    </div>
  );
}
