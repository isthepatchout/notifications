import antfu from "@antfu/eslint-config"

export default antfu({
  stylistic: false,
  typescript: {
    tsconfigPath: "tsconfig.json",
    overrides: {
      "no-console": "off",
      "ts/no-use-before-define": "off",
      "ts/consistent-type-definitions": "off",
      "ts/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "ts/no-unsafe-argument": "off",
      "ts/no-unsafe-assignment": "off",

      "node/prefer-global/process": "off",
    },
  },
})
