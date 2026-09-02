import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import { AppConfigService } from '@/config/config.service';
import type { AuthenticatedAdmin } from '../decorators/current-user.decorator';
import { ACCESS_TOKEN_COOKIE } from '../auth.cookies';
import type { AccessTokenPayload } from '../auth.types';

/**
 * Access token strategy.
 *
 * The token is read from an httpOnly cookie, with the Authorization header as
 * a secondary source so Swagger and integration tests stay usable. Cookies are
 * the mechanism for the real admin app — localStorage is XSS-readable
 * (PROJECT_PLAN.md §12.2).
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedAdmin {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      mustChangePassword: payload.mustChangePassword,
    };
  }
}
