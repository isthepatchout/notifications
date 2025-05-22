import { defineConfig } from "tsdown"

export default defineConfig({
  entry: "src/index.ts",
  outDir: "dist",
  external: ["bun", "bun:*"],

  env: {
    BUN_ENV: process.env.BUN_ENV || process.env.NODE_ENV || "production",
    DEV: ((process.env.BUN_ENV || process.env.NODE_ENV) ===
      "development") as unknown as string,
    PROD: ((process.env.BUN_ENV || process.env.NODE_ENV) ===
      "production") as unknown as string,
    TEST: false as unknown as string,
  },

  platform: "node",
  target: "node22",
  format: "esm",
  fixedExtension: true,
  hash: false,

  minify: true,
  sourcemap: true,
})
