import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".venv/**",
    ".notebooklm/**",
    "node_modules/**",
    "test-results/**",
    "playwright-report/**",
    // Nested git worktrees managed by Claude Code
    ".claude/**",
    // UI mockup reference files (not production code)
    "frontend-design/**",
  ]),
]);

export default eslintConfig;
