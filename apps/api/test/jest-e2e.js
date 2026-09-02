/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          // Needed to transform the ESM-only dependencies listed in
          // transformIgnorePatterns below.
          allowJs: true,
          module: 'CommonJS',
          esModuleInterop: true,
          target: 'ES2023',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          strict: false,
          skipLibCheck: true,
        },
      },
    ],
  },
  /**
   * sanitize-html depends on htmlparser2 v12, which is ESM-only. Node can
   * `require()` it from 20.19 onward, but Jest's CommonJS runtime cannot — it
   * throws "Cannot use import statement outside a module".
   *
   * These packages are therefore compiled to CJS on the way in rather than
   * being skipped like the rest of node_modules.
   */
  transformIgnorePatterns: [
    // Ignore everything in node_modules EXCEPT sanitize-html and the packages
    // nested beneath it. Anchoring with ^ and testing the whole path is what
    // makes this work: htmlparser2 and its own ESM dependencies live at
    // sanitize-html/node_modules/*, so a pattern anchored to a path segment
    // matches again at the inner node_modules and re-ignores them.
    '^(?!.*sanitize-html).*node_modules',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '^@isd/shared-types$': '<rootDir>/../../../packages/shared-types/src/index.ts',
  },
};
