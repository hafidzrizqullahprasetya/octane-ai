import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Root-level vitest config for octane-ai.
//
// ROOT CAUSE this fixes: running `npx vitest run <file>` from the repo root
// (or any non-tests/ directory) made vitest treat the CWD as the project
// root. No config existed there, so the alias map that lives in
// tests/vitest.config.js (`open-sse/` → ./open-sse, `@/` → ./src) was never
// loaded — every test importing `open-sse/...` or `@/lib/...` failed with
// "Cannot find package" during collection, independent of any code change.
// This config mirrors those aliases from the repo root so test invocation
// works from anywhere. tests/vitest.config.js remains authoritative for runs
// started inside tests/ (npm test).
//
// NOTE: plain-object export on purpose. A root config that imports
// `vitest/config` fails to load when vitest is only installed under tests/
// (node_modules lookup from the repo root cannot see it). defineConfig is a
// typing identity — the object shape is identical.
const here = dirname(fileURLToPath(import.meta.url));

export default {
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.js"],
    exclude: ["**/node_modules/**", "**/.claude/**", "**/.worktrees/**", "**/dist/**"],
    maxConcurrency: 60,
    silent: false,
  },
  resolve: {
    alias: [
      { find: /^open-sse\//, replacement: resolve(here, "open-sse") + "/" },
      { find: "open-sse", replacement: resolve(here, "open-sse") },
      { find: /^@\//, replacement: resolve(here, "src") + "/" },
    ],
  },
};
