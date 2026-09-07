import type { Response } from 'express';

import { clearAuthCookies, durationToMs, setAuthCookies } from './auth.cookies';

/**
 * Cookie policy (PROJECT_PLAN.md §12.2).
 *
 * These assertions exist because the failure they guard against is invisible
 * until deployment: a SameSite=Strict cookie is simply never sent on a
 * cross-site request, so login returns 200 and every call after it returns
 * 401, with nothing in any log to explain why.
 */

function captureCookies() {
  const set: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const cleared: { name: string; options: Record<string, unknown> }[] = [];

  const response = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      set.push({ name, value, options });
    },
    clearCookie: (name: string, options: Record<string, unknown>) => {
      cleared.push({ name, options });
    },
  } as unknown as Response;

  return { response, set, cleared };
}

const tokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
const ages = { accessMaxAgeMs: 900_000, refreshMaxAgeMs: 604_800_000 };

describe('setAuthCookies', () => {
  it('is always httpOnly, in every configuration', () => {
    // The whole reason tokens are in cookies rather than localStorage: XSS
    // must not be able to read them (§12.2).
    for (const policy of [
      { isProduction: false, crossSite: false },
      { isProduction: true, crossSite: false },
      { isProduction: true, crossSite: true },
    ]) {
      const { response, set } = captureCookies();
      setAuthCookies(response, tokens, { ...policy, ...ages });

      expect(set).toHaveLength(2);
      expect(set.every((cookie) => cookie.options.httpOnly === true)).toBe(true);
    }
  });

  it('uses Strict and Secure in production on a shared parent domain', () => {
    const { response, set } = captureCookies();
    setAuthCookies(response, tokens, { isProduction: true, crossSite: false, ...ages });

    expect(set[0].options).toMatchObject({ sameSite: 'strict', secure: true });
  });

  it('relaxes to None when the admin is on a different domain', () => {
    // admin.vercel.app calling api.onrender.com. Strict would never be sent.
    const { response, set } = captureCookies();
    setAuthCookies(response, tokens, { isProduction: true, crossSite: true, ...ages });

    expect(set[0].options).toMatchObject({ sameSite: 'none', secure: true });
  });

  it('forces Secure alongside None even outside production', () => {
    // Browsers reject SameSite=None on a non-Secure cookie outright, so this
    // combination has to hold regardless of NODE_ENV.
    const { response, set } = captureCookies();
    setAuthCookies(response, tokens, { isProduction: false, crossSite: true, ...ages });

    expect(set[0].options).toMatchObject({ sameSite: 'none', secure: true });
  });

  it('stays Lax and insecure locally, so plain http works', () => {
    const { response, set } = captureCookies();
    setAuthCookies(response, tokens, { isProduction: false, crossSite: false, ...ages });

    expect(set[0].options).toMatchObject({ sameSite: 'lax', secure: false });
  });

  it('applies the cookie domain when one is configured', () => {
    const { response, set } = captureCookies();
    setAuthCookies(response, tokens, {
      isProduction: true,
      crossSite: false,
      domain: '.example.com',
      ...ages,
    });

    expect(set[0].options.domain).toBe('.example.com');
  });

  it('omits the domain attribute entirely when none is set', () => {
    // An empty domain string would scope the cookie to nothing.
    const { response, set } = captureCookies();
    setAuthCookies(response, tokens, { isProduction: true, crossSite: false, ...ages });

    expect(set[0].options).not.toHaveProperty('domain');
  });

  it('gives each cookie its own lifetime', () => {
    const { response, set } = captureCookies();
    setAuthCookies(response, tokens, { isProduction: true, crossSite: false, ...ages });

    expect(set[0].options.maxAge).toBe(900_000);
    expect(set[1].options.maxAge).toBe(604_800_000);
  });
});

describe('clearAuthCookies', () => {
  it('clears with the same attributes the cookie was set with', () => {
    // A mismatch on sameSite, secure or domain leaves the cookie in place and
    // the user apparently signed in after logging out.
    const policy = { isProduction: true, crossSite: true, domain: '.example.com' };

    const setter = captureCookies();
    setAuthCookies(setter.response, tokens, { ...policy, ...ages });

    const clearer = captureCookies();
    clearAuthCookies(clearer.response, policy);

    expect(clearer.cleared).toHaveLength(2);

    for (const [index, cleared] of clearer.cleared.entries()) {
      const { maxAge, ...setOptions } = setter.set[index].options;
      void maxAge;
      expect(cleared.options).toEqual(setOptions);
    }
  });
});

describe('durationToMs', () => {
  it.each([
    ['15m', 900_000],
    ['7d', 604_800_000],
    ['30s', 30_000],
    ['2h', 7_200_000],
  ])('converts %s', (input, expected) => {
    expect(durationToMs(input)).toBe(expected);
  });

  it('rejects a malformed duration rather than silently returning NaN', () => {
    // A NaN maxAge produces a session cookie, so the admin is signed out on
    // every browser restart for no visible reason.
    expect(() => durationToMs('15mins')).toThrow();
    expect(() => durationToMs('forever')).toThrow();
  });
});
