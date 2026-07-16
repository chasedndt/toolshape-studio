import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@toolshape/studio-domain": path.resolve(repoRoot, "packages/studio-domain/src/index.ts"),
      "@toolshape/studio-engine": path.resolve(repoRoot, "packages/studio-engine/src/index.ts"),
      "@toolshape/studio-kernel": path.resolve(repoRoot, "packages/studio-kernel/src/index.ts"),
      "@toolshape/studio-media": path.resolve(repoRoot, "packages/studio-media/src/index.ts"),
      "@toolshape/studio-persistence": path.resolve(repoRoot, "packages/studio-persistence/src/index.ts"),
      "@toolshape/studio-render": path.resolve(repoRoot, "packages/studio-render/src/index.ts"),
      "@toolshape/studio-sdk": path.resolve(repoRoot, "packages/studio-sdk/src/index.ts"),
      "@toolshape/studio-fixture": path.resolve(repoRoot, "fixtures/studio/golden-project.ts"),
    },
  },
  server: {
    fs: { allow: [repoRoot] },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "../../packages/studio-domain/tests/**/*.test.ts",
      "../../packages/studio-engine/tests/**/*.test.ts",
      "../../packages/studio-render/tests/**/*.test.ts",
      "../../packages/studio-kernel/tests/**/*.test.ts",
      "../../packages/studio-media/tests/**/*.test.ts",
      "../../packages/studio-persistence/tests/**/*.test.ts",
      "../../packages/studio-sdk/tests/**/*.test.ts"
    ],
  },
});
