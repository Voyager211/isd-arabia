import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the globally applied JWT guard.
 *
 * The guard is global and routes opt out, rather than the reverse — a new
 * admin endpoint is protected by default, and forgetting a decorator fails
 * closed instead of open.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
