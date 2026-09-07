import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Revalidation endpoint (PROJECT_PLAN.md §4.2, acceptance criteria #31–32).
 *
 * This route is the one publicly reachable thing on the storefront that does
 * anything other than render. It takes a shared secret and, on the strength of
 * it, purges cache. It had no test.
 *
 * Criterion #32 — "the revalidation endpoint rejects requests with a missing or
 * incorrect secret" — is exactly the kind of guard that works right up until
 * someone refactors the header name.
 */

const revalidateTag = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: (tag: string) => revalidateTag(tag),
}));

/** Imported lazily so the env is in place before the module reads it. */
async function post(body: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import('./route');

  const request = new Request('http://localhost:3000/api/revalidate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

  // The handler only uses `headers.get` and `json()`, both of which a standard
  // Request provides.
  const response = await POST(request as never);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const SECRET = 'test-revalidate-secret-value';

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    vi.resetModules();
    process.env.REVALIDATE_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.REVALIDATE_SECRET;
  });

  describe('authentication', () => {
    it('purges the given tags when the secret matches', async () => {
      const result = await post(
        { tags: ['products:list', 'category:tig-welding'] },
        { 'x-revalidate-secret': SECRET },
      );

      expect(result.status).toBe(200);
      expect(revalidateTag).toHaveBeenCalledTimes(2);
      expect(revalidateTag).toHaveBeenCalledWith('products:list');
      expect(revalidateTag).toHaveBeenCalledWith('category:tig-welding');
    });

    it('rejects a request with no secret', async () => {
      const result = await post({ tags: ['products:list'] });

      expect(result.status).toBe(401);
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('rejects a request with the wrong secret', async () => {
      const result = await post(
        { tags: ['products:list'] },
        { 'x-revalidate-secret': 'not-the-secret' },
      );

      expect(result.status).toBe(401);
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('rejects an empty secret header', async () => {
      const result = await post({ tags: ['products:list'] }, { 'x-revalidate-secret': '' });

      expect(result.status).toBe(401);
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('fails closed when the server has no secret configured', async () => {
      // Without this the endpoint would accept ANY caller on a deployment
      // where the variable was forgotten — the worst possible default.
      delete process.env.REVALIDATE_SECRET;

      const result = await post({ tags: ['products:list'] }, { 'x-revalidate-secret': '' });

      expect(result.status).toBe(500);
      expect(revalidateTag).not.toHaveBeenCalled();
    });
  });

  describe('payload validation', () => {
    const authed = { 'x-revalidate-secret': SECRET };

    it('rejects a body that is not JSON', async () => {
      const result = await post('{ not json', authed);
      expect(result.status).toBe(400);
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('rejects an empty tag list', async () => {
      expect((await post({ tags: [] }, authed)).status).toBe(400);
    });

    it('rejects a missing tag list', async () => {
      expect((await post({}, authed)).status).toBe(400);
    });

    it('rejects a tags value that is not an array', async () => {
      expect((await post({ tags: 'products:list' }, authed)).status).toBe(400);
    });

    it('discards non-string and empty entries', async () => {
      const result = await post({ tags: ['products:list', 42, '', null] }, authed);

      expect(result.status).toBe(200);
      // Only the one usable tag survives.
      expect(revalidateTag).toHaveBeenCalledTimes(1);
      expect(revalidateTag).toHaveBeenCalledWith('products:list');
    });

    it('caps the number of tags in one request', async () => {
      // An unbounded list is a cheap way to make the storefront do a lot of
      // work on someone else's schedule.
      const result = await post(
        { tags: Array.from({ length: 51 }, (_, index) => `tag-${index}`) },
        authed,
      );

      expect(result.status).toBe(400);
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('accepts exactly the cap', async () => {
      const result = await post(
        { tags: Array.from({ length: 50 }, (_, index) => `tag-${index}`) },
        authed,
      );

      expect(result.status).toBe(200);
      expect(revalidateTag).toHaveBeenCalledTimes(50);
    });
  });

  it('reports which tags it purged', async () => {
    const result = await post(
      { tags: ['home', 'products:list'] },
      { 'x-revalidate-secret': SECRET },
    );

    expect(result.body).toMatchObject({
      success: true,
      data: { revalidated: ['home', 'products:list'] },
    });
  });
});
