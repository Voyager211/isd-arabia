import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';
import type { AuthenticatedAdmin } from '../decorators/current-user.decorator';

/**
 * Enforces the forced first-use password change (PROJECT_PLAN.md §12.1,
 * acceptance criterion #16).
 *
 * Enforced server-side, not by an admin-app redirect. A client-only guard is
 * cosmetic — the API would still answer with the seeded credential, which is
 * the exact thing an automated scanner would be trying.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const bypass = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (bypass || isPublic) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedAdmin }>();
    if (user?.mustChangePassword) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You must change your password before continuing.',
      });
    }

    return true;
  }
}
