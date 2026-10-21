// The Next.js scaffold's small architectural baseline. Review changes to these rules.
// The patterns describe roles; they do not require every file to carry a role suffix.
const source = '^src/';
const pure = '(\\.(rules|schema)\\.[cm]?[jt]s$|^(node_modules/)?zod(/|$))';

module.exports = {
  forbidden: [
    {
      name: 'no-runtime-cycles', severity: 'error',
      from: { path: source },
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
    },
    {
      name: 'pure-rules', severity: 'error',
      comment: 'Business rules use inputs, other pure rules/schema modules and Zod; IO and frameworks stay outside.',
      from: { path: '\\.(rules|schema)\\.[cm]?[jt]s$' },
      to: { pathNot: pure, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'shared-does-not-import-features', severity: 'error',
      from: { path: '^src/(lib|components|hooks)/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'features-do-not-import-routes', severity: 'error',
      from: { path: '^src/features/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'no-unresolved-imports', severity: 'error',
      from: { path: source },
      to: { couldNotResolve: true },
    },
  ],
  options: {
    // Scan production code only; tests may deliberately import a module's internals.
    exclude: '(^|/)(\\.next|test)/|\\.(test|spec)\\.[cm]?[jt]sx?$',
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    preserveSymlinks: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
