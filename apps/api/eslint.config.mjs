import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'eslint.config.mjs',
      'jest.config.js',
      'test/jest-e2e.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: {
        // A lint-only project: the build tsconfig covers src alone, so that the
        // emitted dist tree stays flat, but the e2e suite still needs type
        // information to be linted.
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Decorator metadata makes these unavoidable in a Nest codebase.
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // CLAUDE.md §7: no `any` without a justification comment.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    rules: {
      /**
       * Supertest types `response.body` as `any`, so every assertion on a JSON
       * payload trips the unsafe-* rules. Typing each response shape in the
       * tests would add a lot of ceremony to catch nothing — the assertion IS
       * the check, and a wrong shape fails the test loudly.
       *
       * Scoped to test files only; `src` keeps the full type-checked ruleset.
       */
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);
