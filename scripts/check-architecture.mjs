import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Resolve the installed tool from the project, even when this file is copied to a fixture.
export function checkArchitecture(root = process.cwd(), cli) {
  const executable = cli ?? fileURLToPath(new URL('../../bin/dependency-cruise.mjs', import.meta.resolve('dependency-cruiser')));
  const result = spawnSync(process.execPath, [executable, 'src', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  let graph;
  try { graph = JSON.parse(result.stdout); } catch {
    throw new Error(result.stderr || result.stdout || 'Architecture checker produced no dependency graph.');
  }
  if (!graph.modules?.some((module) => module.source.startsWith('src/'))) {
    throw new Error('Architecture checker scanned no source modules. Check its scope before calling this green.');
  }
  const errors = graph.summary?.violations?.filter((violation) => violation.rule.severity === 'error') ?? [];
  if (result.status !== 0 && errors.length === 0) throw new Error(result.stderr || 'Architecture checker failed.');
  return { modules: graph.modules.length, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { modules, errors } = checkArchitecture();
    for (const error of errors) console.error(`${error.rule.name}: ${error.from} -> ${error.to}`);
    console.log(`Architecture: ${modules} modules scanned, ${errors.length} errors.`);
    process.exitCode = errors.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
