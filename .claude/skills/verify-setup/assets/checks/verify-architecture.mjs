// Repeatable positive and negative probes of the ACTUAL project config, away from app code.
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkArchitecture } from './check-architecture.mjs';

const project = process.cwd();
const tests = [
  ['allowed alias import', null, {
    'app/page.ts': "import { price } from '@/features/orders/price.rules'; export const page = price(2);",
    'features/orders/price.rules.ts': 'export const price = (n: number) => n * 3;',
  }],
  ['rules importing data by alias', 'pure-rules', {
    'features/orders/price.rules.ts': "import { total } from '@/features/orders/orders.data'; export const price = total;",
    'features/orders/orders.data.ts': 'export const total = 3;',
  }],
  ['shared importing a feature', 'shared-does-not-import-features', {
    'lib/utility.ts': "export { value } from '@/features/orders/orders';",
    'features/orders/orders.ts': 'export const value = 1;',
  }],
  ['feature importing a route', 'features-do-not-import-routes', {
    'features/orders/orders.ts': "export { value } from '@/app/page';",
    'app/page.ts': 'export const value = 1;',
  }],
  ['runtime cycle', 'no-runtime-cycles', {
    'features/orders/a.ts': "import { b } from './b'; export const a = () => b();",
    'features/orders/b.ts': "import { a } from './a'; export const b = () => a();",
  }],
  ['rules importing a framework package', 'pure-rules', {
    'features/orders/price.rules.ts': "import { useState } from 'react'; export const price = useState;",
  }],
  ['pure schema and Zod', null, {
    'features/orders/price.rules.ts': "import { schema } from './price.schema'; export const price = (n: unknown) => schema.parse(n);",
    'features/orders/price.schema.ts': "import { z } from 'zod'; export const schema = z.number();",
  }],
  ['type-only cycle', null, {
    'features/orders/a.ts': "import type { B } from './b'; export type A = { b?: B };",
    'features/orders/b.ts': "import type { A } from './a'; export type B = { a?: A };",
  }],
  ['unresolved import', 'no-unresolved-imports', {
    'features/orders/orders.ts': "export { value } from '@/missing';",
  }],
];

let failed = false;
for (const [name, expectedRule, files] of tests) {
  const root = mkdtempSync(join(tmpdir(), 'kit-architecture-'));
  try {
    copyFileSync(join(project, '.dependency-cruiser.cjs'), join(root, '.dependency-cruiser.cjs'));
    // Keep the project's resolver settings and its installed dependencies. The config and
    // fixtures use exactly the src/ paths the real scan uses; no alternative test rules.
    copyFileSync(join(project, 'tsconfig.json'), join(root, 'tsconfig.json'));
    writeFileSync(join(root, 'package.json'), '{}\n');
    symlinkSync(join(project, 'node_modules'), join(root, 'node_modules'), 'junction');
    for (const [file, source] of Object.entries(files)) {
      const target = join(root, 'src', file);
      mkdirSync(join(target, '..'), { recursive: true });
      writeFileSync(target, source);
    }
    const result = checkArchitecture(root);
    if (expectedRule) assert(result.errors.some((error) => error.rule.name === expectedRule), `${expectedRule} did not reject the fixture`);
    else assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const empty = mkdtempSync(join(tmpdir(), 'kit-architecture-empty-'));
try {
  copyFileSync(join(project, '.dependency-cruiser.cjs'), join(empty, '.dependency-cruiser.cjs'));
  copyFileSync(join(project, 'tsconfig.json'), join(empty, 'tsconfig.json'));
  mkdirSync(join(empty, 'src'));
  // Give TypeScript an input outside the scan; this proves a valid but empty src graph
  // is rejected by our guard, rather than failing earlier on an invalid tsconfig.
  writeFileSync(join(empty, 'outside.ts'), 'export const outside = 1;');
  assert.throws(() => checkArchitecture(empty), /scanned no source modules/);
  console.log('PASS empty scan is rejected');
} catch (error) {
  failed = true;
  console.error(`FAIL empty scan: ${error.message}`);
} finally {
  rmSync(empty, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
