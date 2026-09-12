import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // Matches the JSX runtime Next/SWC use for the app itself; the tsconfig's
  // "preserve" is a hint for Next's own transform, which esbuild can't read.
  esbuild: {
    jsx: "automatic",
  },
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    testTimeout: 30000,
  },
});
