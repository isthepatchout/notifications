import { defineConfig } from "tsdown"

export default defineConfig({
  entry: "src/index.ts",
  outDir: "dist",
  deps: { onlyBundle: false },

  env: {
    NODE_ENV: process.env.NODE_ENV || "production",
    DEV: process.env.NODE_ENV === "development",
    PROD: process.env.NODE_ENV === "production",
    TEST: false,
  },

  platform: "node",
  format: "esm",
  fixedExtension: true,
  hash: false,

  minify: true,
  sourcemap: true,
})
