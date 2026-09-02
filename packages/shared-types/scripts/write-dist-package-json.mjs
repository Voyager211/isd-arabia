import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * tsc emits plain `.js` into both dist trees. Node decides whether a `.js`
 * file is ESM or CJS from the nearest package.json `type`, and the root
 * package.json cannot say both — so each tree gets its own marker.
 *
 * Without this, the ESM build is loaded as CommonJS and every `import`
 * statement in it is a syntax error.
 */
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

for (const [dir, type] of [
  ['cjs', 'commonjs'],
  ['esm', 'module'],
]) {
  const target = join(dist, dir);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'package.json'), `${JSON.stringify({ type }, null, 2)}\n`);
}

console.log('Wrote dist/cjs/package.json and dist/esm/package.json');
