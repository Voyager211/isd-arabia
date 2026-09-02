import type { AdminRole } from '@isd/shared-types';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: AdminRole;
  mustChangePassword: boolean;
}

export interface RefreshTokenPayload {
  sub: string;
  email: string;
  /**
   * Random per-issue id.
   *
   * Without it, two refresh tokens signed for the same admin within the same
   * second have byte-identical payloads (`sub`, `email`, `iat`, `exp`) and so
   * are the *same string*. Rotation then silently does nothing: the "old"
   * token still matches the stored hash, and a stolen token stays valid
   * through every subsequent refresh.
   */
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * A JWT lifetime as configured in the environment: a whole number followed by
 * a unit. Declaring it as a template literal rather than `string` lets it pass
 * straight into `expiresIn` without a cast, and makes a typo like '15mins'
 * a type error at the config boundary instead of a runtime throw.
 */
export type TokenDuration = `${number}s` | `${number}m` | `${number}h` | `${number}d`;
