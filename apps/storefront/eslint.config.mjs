import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';

/**
 * Flat config, invoked through the ESLint CLI rather than `next lint`.
 *
 * `next lint` is deprecated in Next 15 and prompts interactively when it finds
 * no config — which hangs CI rather than failing it, the worst of both.
 */
export default tseslint.config(
  { ignores: ['.next', 'node_modules', 'next-env.d.ts', 'eslint.config.mjs'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: { '@next/next': nextPlugin },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // CLAUDE.md §7: no `any` without a comment justifying it.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
