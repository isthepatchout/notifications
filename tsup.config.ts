import { execSync } from "node:child_process"

import { defineConfig } from "tsup"

const gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",

  env: {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    NODE_ENV: process.env.NODE_ENV || "production",
    DEV: (process.env.NODE_ENV === "development") as unknown as string,
    PROD: (process.env.NODE_ENV === "production") as unknown as string,
    TEST: false as unknown as string,
    GIT_SHA: JSON.stringify(gitSha),
  },

  target: "node21",
  format: ["esm"],
  banner: {
    js: "const require = (await import('node:module')).createRequire(import.meta.url);const __filename = (await import('node:url')).fileURLToPath(import.meta.url);const __dirname = (await import('node:path')).dirname(__filename);",
  },
  esbuildOptions: (options) => {
    options.supported = {
      // For better performance: https://github.com/evanw/esbuild/issues/951
      "object-rest-spread": false,
    }
  },

  bundle: true,
  sourcemap: true,
  clean: true,
  minify: true,
})
