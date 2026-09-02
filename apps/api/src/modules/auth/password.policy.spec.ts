import { checkPasswordPolicy, SEEDED_DEFAULT_PASSWORD } from './password.policy';

describe('checkPasswordPolicy', () => {
  it('accepts a password meeting every rule', () => {
    expect(checkPasswordPolicy('Sh0rewall!Rigging').valid).toBe(true);
  });

  it.each([
    ['too short', 'Ab1!efgh'],
    ['no uppercase', 'sh0rewall!rigging'],
    ['no lowercase', 'SH0REWALL!RIGGING'],
    ['no digit', 'Shorewall!Rigging'],
    ['no symbol', 'Sh0rewallRigging'],
  ])('rejects a password with %s', (_label, password) => {
    expect(checkPasswordPolicy(password).valid).toBe(false);
  });

  it('rejects the seeded default even though it satisfies the character rules', () => {
    // Guardrail 3, PROJECT_PLAN.md §12.1 — a forced change that accepts the
    // same value back is not a change.
    expect(checkPasswordPolicy(SEEDED_DEFAULT_PASSWORD).valid).toBe(false);
  });
});
