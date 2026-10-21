#!/usr/bin/env node
// One source for the files used by create and the opt-in upgrade of an older scaffold.
// Preview by default. No dependency installation, command execution or registry guessing.
const fs = require('node:fs');
const path = require('node:path');

const BASE_CHECK = 'npm run lint && npm run typecheck && npm test && npm run build';
const STRUCTURE_CHECK = 'npm run lint && npm run typecheck && npm run check:structure && npm test && npm run build';
const QUALITY_FILES = {
  '.dependency-cruiser.cjs': 'dependency-cruiser.cjs',
  'scripts/check-architecture.mjs': 'check-architecture.mjs',
  'scripts/verify-architecture.mjs': 'verify-architecture.mjs',
};
const DEPENDENCY = '^17.4.3'; // Node 20.12 / 22 / 24+, matching the existing stack.

function plan(root, { structure = false, fresh = false } = {}) {
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!fresh) {
    const stamp = JSON.parse(fs.readFileSync(path.join(root, '.ai-eng-kit'), 'utf8'));
    if (stamp.mode !== 'new' || stamp.stack?.framework !== 'nextjs') {
      throw new Error('This helper upgrades only a Next.js project scaffolded by the kit. An existing project keeps its own tooling.');
    }
  }
  if (!pkg.dependencies?.next) throw new Error('No Next.js dependency declared. Nothing was changed.');
  for (const name of ['lint', 'test', 'build']) {
    if (!pkg.scripts?.[name]) throw new Error(`The ${name} script is missing. Restore the project tooling first. Nothing was changed.`);
  }
  const scripts = {
    typecheck: 'next typegen && tsc --noEmit',
    check: structure ? STRUCTURE_CHECK : BASE_CHECK,
    ...(structure ? {
      'check:structure': 'node scripts/check-architecture.mjs',
      'test:structure': 'node scripts/verify-architecture.mjs',
    } : {}),
  };
  const changes = [];
  const conflicts = [];
  pkg.scripts = { ...pkg.scripts };
  for (const [name, value] of Object.entries(scripts)) {
    const previous = pkg.scripts[name];
    if (previous === value) continue;
    // A user's existing typecheck remains its implementation. The aggregate invokes it.
    if (name === 'typecheck' && previous) continue;
    if (previous && !(name === 'check' && structure && previous === BASE_CHECK)) {
      conflicts.push(`package.json scripts.${name} already has a different definition`);
      continue;
    }
    pkg.scripts[name] = value;
    changes.push(`package.json scripts.${name}: ${value}`);
  }
  const files = [];
  if (structure) {
    if (!pkg.devDependencies?.['dependency-cruiser'] && !pkg.dependencies?.['dependency-cruiser']) {
      pkg.devDependencies = { ...pkg.devDependencies, 'dependency-cruiser': DEPENDENCY };
      changes.push(`package.json devDependencies.dependency-cruiser: ${DEPENDENCY}`);
    }
    for (const [dest, source] of Object.entries(QUALITY_FILES)) {
      const body = fs.readFileSync(path.join(__dirname, '..', 'assets', 'checks', source));
      const target = path.join(root, dest);
      const parent = path.dirname(target);
      if (fs.existsSync(parent)) {
        const parentPath = fs.realpathSync(parent);
        const rootPath = fs.realpathSync(root);
        const inside = parentPath === rootPath || parentPath.startsWith(rootPath + path.sep);
        if (!fs.statSync(parent).isDirectory() || !inside) {
          conflicts.push(`${path.relative(root, parent)} is not a directory inside this project`);
          continue;
        }
      }
      if (fs.existsSync(target)) {
        if (!fs.readFileSync(target).equals(body)) conflicts.push(`${dest} already has different content`);
      } else {
        files.push({ dest, body });
        changes.push(`add ${dest}`);
      }
    }
  }
  return { pkgPath, pkg, changes, conflicts, files };
}

function apply(root, options) {
  const result = plan(root, options);
  if (result.conflicts.length) throw new Error(`${result.conflicts.join('\n')}. Review those definitions before adopting the checks. Nothing was changed.`);
  for (const { dest, body } of result.files) {
    const target = path.join(root, dest);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body, { flag: 'wx' });
  }
  if (result.changes.some((change) => change.startsWith('package.json '))) {
    fs.writeFileSync(result.pkgPath, JSON.stringify(result.pkg, null, 2) + '\n');
  }
  return result;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => !['--apply', '--structure'].includes(arg))) throw new Error('Usage: node setup-checks.cjs [--structure] [--apply] (in the project root)');
    const options = { structure: args.includes('--structure') };
    const result = args.includes('--apply') ? apply(process.cwd(), options) : plan(process.cwd(), options);
    for (const change of result.changes) console.log(change);
    for (const conflict of result.conflicts) console.error(`CONFLICT: ${conflict}`);
    if (result.conflicts.length) process.exitCode = 1;
    else console.log(args.includes('--apply') ? 'Applied. Install any added dependencies, then record the check command with the project initializer.' : 'Preview only. Add --apply to adopt these changes.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { plan, apply, BASE_CHECK, STRUCTURE_CHECK, QUALITY_FILES };
