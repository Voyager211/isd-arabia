import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import { AppConfigService } from '@/config/config.service';
import { REFRESH_TOKEN_COOKIE } from '../auth.cookies';
import type { RefreshTokenPayload } from '../auth.types';

export interface RefreshRequestUser {
  id: string;
  email: string;
  /** The raw token, needed to compare against the stored bcrypt hash. */
  refreshToken: string;
}

/**
 * Refresh strategy. `passReqToCallback` is on because rotation has to compare
 * the presented token against the hash on the user record — proving the JWT
 * signature alone is not enough once a token has been rotated out.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.[REFRESH_TOKEN_COOKIE] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwt.refreshSecret,
      passReqToCallback: true,
    });
  }

  validate(request: Request, payload: RefreshTokenPayload): RefreshRequestUser {
    const refreshToken = request?.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing.');
    }
    return { id: payload.sub, email: payload.email, refreshToken };
  }
}
