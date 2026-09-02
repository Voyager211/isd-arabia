import { Navigate, Outlet, useLocation } from 'react-router';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/context/auth-context';

function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Loader2 aria-hidden className="size-6 animate-spin text-text-muted" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/**
 * Blocks every admin route until the session is known and the forced password
 * change is done (PROJECT_PLAN.md §12.1, acceptance criterion #16).
 *
 * This is a routing affordance, not the security boundary — the API applies
 * the same two rules server-side. A client-only guard would be cosmetic: the
 * API would still answer requests made with the seeded credential, which is
 * exactly what an automated scanner would be trying.
 */
export function RequireAuth() {
  const { status, mustChangePassword } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;

  if (status === 'unauthenticated') {
    // `from` lets the login screen return the admin to where they were headed.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}

/** Keeps a signed-in admin out of the login screen. */
export function RequireAnonymous() {
  const { status, mustChangePassword } = useAuth();

  if (status === 'loading') return <FullPageLoader />;

  if (status === 'authenticated') {
    return <Navigate to={mustChangePassword ? '/change-password' : '/'} replace />;
  }

  return <Outlet />;
}

/**
 * The change-password screen sits outside RequireAuth, because RequireAuth
 * redirects here — guarding it with RequireAuth would be a redirect loop. It
 * still requires a session.
 */
export function RequirePasswordChange() {
  const { status, mustChangePassword } = useAuth();

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (!mustChangePassword) return <Navigate to="/" replace />;

  return <Outlet />;
}
