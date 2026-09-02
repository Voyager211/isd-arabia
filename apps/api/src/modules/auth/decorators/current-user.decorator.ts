import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AdminRole } from '@isd/shared-types';

/** The JWT payload the access-token strategy attaches to the request. */
export interface AuthenticatedAdmin {
  id: string;
  email: string;
  role: AdminRole;
  mustChangePassword: boolean;
}

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedAdmin | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedAdmin }>();
    return field ? request.user?.[field] : request.user;
  },
);
