import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE } from '@isd/shared-types';

/**
 * Password policy for admin password changes (PROJECT_PLAN.md §12.1).
 *
 * Guardrail 3: the new password must also differ from the documented seed
 * default, so "change the password" cannot be satisfied by re-entering it.
 */
export const SEEDED_DEFAULT_PASSWORD = '@Password123';
export const SEEDED_DEFAULT_EMAIL = 'superadmin@example.com';

export interface PasswordCheck {
  valid: boolean;
  message?: string;
}

export function checkPasswordPolicy(password: string): PasswordCheck {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE };
  }

  const rules = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
  if (!rules.every((rule) => rule.test(password))) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE };
  }

  if (password === SEEDED_DEFAULT_PASSWORD) {
    return {
      valid: false,
      message: 'Choose a password other than the default seeded credential.',
    };
  }

  return { valid: true };
}
