import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    // shadcn/ui primitives are vendored third-party code (never hand-edited per the kit's
    // conventions) — don't lint them with the app's rules.
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/components/ui/**",
    ],
  },
];

export default eslintConfig;
