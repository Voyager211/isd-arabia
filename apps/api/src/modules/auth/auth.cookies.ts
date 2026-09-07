import type { CookieOptions, Request, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'isd_at';
export const REFRESH_TOKEN_COOKIE = 'isd_rt';

/**
 * Cookie policy (PROJECT_PLAN.md §12.2).
 *
 * httpOnly so XSS cannot read the token, secure in production, and
 * sameSite 'strict' because the admin SPA is the only caller and there is no
 * cross-site flow to accommodate.
 *
 * `sameSite: 'none'` in development would be needed for a cross-origin dev
 * setup, but 'lax' keeps localhost workable without weakening production.
 */
function baseOptions(isProduction: boolean, domain?: string): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

export function setAuthCookies(
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
  options: {
    isProduction: boolean;
    domain?: string;
    accessMaxAgeMs: number;
    refreshMaxAgeMs: number;
  },
): void {
  const base = baseOptions(options.isProduction, options.domain);

  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: options.accessMaxAgeMs,
  });
  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: options.refreshMaxAgeMs,
  });
}

export function clearAuthCookies(
  response: Response,
  options: { isProduction: boolean; domain?: string },
): void {
  const base = baseOptions(options.isProduction, options.domain);
  response.clearCookie(ACCESS_TOKEN_COOKIE, base);
  response.clearCookie(REFRESH_TOKEN_COOKIE, base);
}

/**
 * Converts a JWT-style duration ('15m', '7d') into milliseconds for the
 * matching cookie `maxAge`.
 *
 * Written out rather than pulling in `ms` so the cookie lifetime and the token
 * lifetime are guaranteed to come from the same single env value, with no
 * second parser that could disagree.
 */
const DURATION_UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function durationToMs(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(duration.trim());
  if (!match) {
    throw new Error(
      `Unsupported token duration '${duration}'. Use a whole number followed by s, m, h or d.`,
    );
  }
  return Number(match[1]) * DURATION_UNITS[match[2].toLowerCase()];
}

/**
 * Reads one cookie off the request.
 *
 * Express types `req.cookies` as `any`, so every direct access spreads that
 * `any` outward. Narrowing it once here keeps the strategies type-safe and
 * gives one place to change if the transport ever moves off cookies.
 */
export function readCookie(request: Request, name: string): string | null {
  const jar = (request as { cookies?: Record<string, unknown> }).cookies;
  const value = jar?.[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
