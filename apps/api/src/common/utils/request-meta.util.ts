import type { Request } from 'express';

import type { RequestMeta } from '@isd/shared-types';

/**
 * Captures the provenance stored on quotations and catalogue leads.
 *
 * `x-forwarded-for` is only trustworthy behind a proxy we control; the app
 * enables Express `trust proxy` in main.ts so `req.ip` already resolves it.
 */
export function extractRequestMeta(request: Request): RequestMeta {
  return {
    userAgent: request.get('user-agent')?.slice(0, 512),
    ipAddress: request.ip,
    referrer: request.get('referer')?.slice(0, 512),
  };
}
