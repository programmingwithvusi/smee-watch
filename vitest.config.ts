import { defineConfig } from "vitest/config";

// The dashboard/ folder is its own package with its own tests; keep this run to the watcher only.
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
