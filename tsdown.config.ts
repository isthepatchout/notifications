import { defineConfig } from "tsdown"

export default defineConfig({
  entry: "src/index.ts",
  outDir: "dist",
  deps: {
    onlyBundle: [
      "agent-base",
      "alleviate",
      "asn1.js",
      "bn.js",
      "buffer-equal-constant-time",
      "debug",
      "ecdsa-sig-formatter",
      "evlog",
      "http_ece",
      "https-proxy-agent",
      "inherits",
      "jwa",
      "jws",
      "minimalistic-assert",
      "ms",
      "safe-buffer",
      "safer-buffer",
      "web-push",
      "xior",
    ],
  },

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
