import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",

  env: {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    BUN_ENV: process.env.BUN_ENV || process.env.NODE_ENV || "production",
    DEV: ((process.env.BUN_ENV || process.env.NODE_ENV) ===
      "development") as unknown as string,
    PROD: ((process.env.BUN_ENV || process.env.NODE_ENV) ===
      "production") as unknown as string,
    TEST: false as unknown as string,
  },

  platform: "node",
  target: "node22",
  format: ["esm"],
  banner: {
    js: "const require = (await import('node:module')).createRequire(import.meta.url);const __filename = (await import('node:url')).fileURLToPath(import.meta.url);const __dirname = (await import('node:path')).dirname(__filename);",
  },

  esbuildOptions: (options) => {
    options.alias = {
      "readable-stream": "node:stream",
    }
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
