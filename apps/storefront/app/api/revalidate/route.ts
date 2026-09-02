import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * On-demand revalidation endpoint (PROJECT_PLAN.md §4.2).
 *
 * The NestJS API calls this after a successful catalogue write so an admin's
 * edit is live within seconds rather than at the end of the route's ISR
 * window. Without it an admin saves a product, does not see it, and files a
 * bug — acceptance criteria #18 and #31.
 */

export const runtime = 'nodejs';
/** Never cache the purge endpoint itself. */
export const dynamic = 'force-dynamic';

const MAX_TAGS = 50;

interface RevalidateBody {
  tags?: unknown;
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    // Failing closed: without a configured secret the endpoint would accept
    // any caller, so it refuses to work at all.
    console.error('[revalidate] REVALIDATE_SECRET is not set — refusing all requests.');
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Not configured.' } },
      { status: 500 },
    );
  }

  const presented = request.headers.get('x-revalidate-secret');

  // Acceptance criterion #32: a missing or wrong secret is rejected and logged.
  if (presented !== secret) {
    console.warn(`[revalidate] Rejected request with ${presented ? 'an incorrect' : 'no'} secret.`);
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid secret.' } },
      { status: 401 },
    );
  }

  let body: RevalidateBody;
  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Body must be JSON.' } },
      { status: 400 },
    );
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
    : [];

  if (!tags.length) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Provide a non-empty `tags` array.' },
      },
      { status: 400 },
    );
  }

  if (tags.length > MAX_TAGS) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `At most ${MAX_TAGS} tags per request.` },
      },
      { status: 400 },
    );
  }

  for (const tag of tags) {
    revalidateTag(tag);
  }

  return NextResponse.json({
    success: true,
    data: { revalidated: tags, at: new Date().toISOString() },
  });
}
