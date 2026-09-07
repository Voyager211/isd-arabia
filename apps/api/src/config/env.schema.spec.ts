import { validateEnv } from './env.schema';

/**
 * The production guardrail from PROJECT_PLAN.md §12.1.
 *
 * These tests exist because the original implementation checked only that
 * SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD were SET, while its own comment
 * claimed the default credential was "refused". Nothing stopped anyone pasting
 * the documented values into a production dashboard — the precise outcome the
 * guardrail is for.
 */

const base = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://localhost:27017',
  MONGODB_DB_NAME: 'isd',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CLOUDINARY_CLOUD_NAME: 'cloud',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
  STOREFRONT_ORIGIN: 'https://store.test',
  ADMIN_ORIGIN: 'https://admin.test',
  STOREFRONT_REVALIDATE_URL: 'https://store.test/api/revalidate',
  REVALIDATE_SECRET: 'c'.repeat(20),
  TURNSTILE_SECRET_KEY: 'turnstile',
  QUOTATION_NOTIFY_ENABLED: 'false',
  SEED_ADMIN_EMAIL: 'ops@isdarabia.test',
  SEED_ADMIN_PASSWORD: 'Sh0rewall!Rigging24',
};

describe('production seed-credential guardrail', () => {
  it('accepts a proper credential', () => {
    expect(() => validateEnv(base)).not.toThrow();
  });

  it('refuses the documented default email', () => {
    expect(() => validateEnv({ ...base, SEED_ADMIN_EMAIL: 'superadmin@example.com' })).toThrow(
      /first address any scanner tries/,
    );
  });

  it('refuses the default email regardless of casing', () => {
    expect(() => validateEnv({ ...base, SEED_ADMIN_EMAIL: 'SuperAdmin@Example.com' })).toThrow(
      /scanner/,
    );
  });

  it('refuses the documented default password', () => {
    expect(() => validateEnv({ ...base, SEED_ADMIN_PASSWORD: '@Password123' })).toThrow(
      /default password/,
    );
  });

  it('refuses a weak custom password', () => {
    // Without this, "letmein" would be perfectly acceptable in production.
    expect(() => validateEnv({ ...base, SEED_ADMIN_PASSWORD: 'letmein' })).toThrow(
      /too weak for production/,
    );
  });

  it('still requires both to be present', () => {
    const { SEED_ADMIN_PASSWORD, ...withoutPassword } = base;
    void SEED_ADMIN_PASSWORD;
    expect(() => validateEnv(withoutPassword)).toThrow(/required in production/);
  });

  it('leaves development alone, so the documented default still works locally', () => {
    // The default credential is deliberately usable outside production — that
    // is what makes the getting-started instructions work.
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'development',
        SEED_ADMIN_EMAIL: 'superadmin@example.com',
        SEED_ADMIN_PASSWORD: '@Password123',
      }),
    ).not.toThrow();
  });

  it('allows development to omit them entirely', () => {
    const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, ...rest } = base;
    void SEED_ADMIN_EMAIL;
    void SEED_ADMIN_PASSWORD;
    expect(() => validateEnv({ ...rest, NODE_ENV: 'development' })).not.toThrow();
  });
});

describe('CORS origin normalisation', () => {
  const base = {
    NODE_ENV: 'development',
    MONGODB_URI: 'mongodb://localhost:27017',
    MONGODB_DB_NAME: 'isd',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    CLOUDINARY_CLOUD_NAME: 'cloud',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
    STOREFRONT_REVALIDATE_URL: 'https://store.test/api/revalidate',
    REVALIDATE_SECRET: 'c'.repeat(20),
    TURNSTILE_SECRET_KEY: 'turnstile',
    QUOTATION_NOTIFY_ENABLED: 'false',
    STOREFRONT_ORIGIN: 'https://store.test',
    ADMIN_ORIGIN: 'https://admin.test',
  };

  it('strips a trailing slash', () => {
    // The address bar shows "https://admin.test/", so that is what gets pasted
    // into a hosting dashboard. The browser's Origin header never has one and
    // the CORS comparison is exact — an unstripped slash matches nothing and
    // reports no error anywhere.
    const env = validateEnv({ ...base, ADMIN_ORIGIN: 'https://admin.test/' });
    expect(env.ADMIN_ORIGIN).toBe('https://admin.test');
  });

  it('strips several trailing slashes', () => {
    const env = validateEnv({ ...base, ADMIN_ORIGIN: 'https://admin.test///' });
    expect(env.ADMIN_ORIGIN).toBe('https://admin.test');
  });

  it('leaves a bare origin untouched', () => {
    const env = validateEnv({ ...base, ADMIN_ORIGIN: 'https://admin.test' });
    expect(env.ADMIN_ORIGIN).toBe('https://admin.test');
  });

  it('keeps the port, which is part of the origin', () => {
    const env = validateEnv({ ...base, ADMIN_ORIGIN: 'http://localhost:5173' });
    expect(env.ADMIN_ORIGIN).toBe('http://localhost:5173');
  });

  it('refuses a path, which can never match an Origin header', () => {
    expect(() => validateEnv({ ...base, ADMIN_ORIGIN: 'https://admin.test/admin' })).toThrow(
      /bare origin/,
    );
  });

  it('normalises the extra origins list too', () => {
    const env = validateEnv({
      ...base,
      EXTRA_CORS_ORIGINS: 'https://preview.test/, https://staging.test',
    });
    expect(env.EXTRA_CORS_ORIGINS).toEqual(['https://preview.test', 'https://staging.test']);
  });
});
