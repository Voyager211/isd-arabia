import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_KEY = 'allowPasswordChange';

/**
 * Marks the handful of routes reachable while `mustChangePassword` is true:
 * the change-password endpoint itself, `/me`, and logout. Everything else is
 * blocked by `PasswordChangeGuard` until the password is rotated.
 */
export const AllowDuringPasswordChange = () => SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
