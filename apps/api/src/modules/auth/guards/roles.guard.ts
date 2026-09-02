import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AdminRole } from '@isd/shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedAdmin } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedAdmin }>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('You do not have access to this resource.');
    }

    return true;
  }
}
