import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { AdminUser, ChangePasswordRequest, LoginResponse } from '@isd/shared-types';

import { get, installAuthInterceptor, post } from '@/lib/api-client';

/**
 * Admin auth state (PROJECT_PLAN.md §12.2).
 *
 * Holds the profile, never a token. Tokens live in httpOnly cookies that this
 * code cannot read — "am I signed in?" is answered by asking the API, not by
 * inspecting storage.
 */

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AdminUser | null;
  /**
   * True while the account is on the seeded credential. Every admin route is
   * blocked until it clears — enforced by the API too, so this is a UX
   * affordance rather than the security boundary (§12.1).
   */
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  changePassword: (payload: ChangePasswordRequest) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AdminUser | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const clearSession = useCallback(() => {
    if (!isMounted.current) return;
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // The interceptor is installed once, here, so a failed refresh flows into
  // React state and the router renders the login screen — rather than a hard
  // page navigation that would throw away an open form (acceptance #17).
  useEffect(() => installAuthInterceptor(clearSession), [clearSession]);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await get<AdminUser>('/admin/auth/me');
      if (!isMounted.current) return;
      setUser(profile);
      setStatus('authenticated');
    } catch {
      clearSession();
    }
  }, [clearSession]);

  // A cookie may already be valid from a previous visit, so the app asks once
  // on mount rather than assuming signed out.
  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await post<LoginResponse>('/admin/auth/login', { email, password });
    setUser(result.user);
    setStatus('authenticated');
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await post('/admin/auth/logout');
    } finally {
      // Signing out locally even if the call failed is the safer outcome —
      // leaving the UI in a signed-in state after an intentional logout is
      // worse than an orphaned refresh token, which expires on its own.
      clearSession();
    }
  }, [clearSession]);

  const changePassword = useCallback(async (payload: ChangePasswordRequest) => {
    const result = await post<LoginResponse>('/admin/auth/change-password', payload);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      mustChangePassword: user?.mustChangePassword ?? false,
      login,
      logout,
      changePassword,
      refreshProfile,
    }),
    [status, user, login, logout, changePassword, refreshProfile],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
