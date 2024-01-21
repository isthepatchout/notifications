module.exports = {
  root: true,
  env: {
    es2021: true,
    browser: true,
  },
  extends: [
    "plugin:@beequeue/base",
    "plugin:@beequeue/node",
    "plugin:@beequeue/typescript",
    "plugin:@beequeue/esm",
  ],
  rules: {
    "@typescript-eslint/no-non-null-assertion": "off",
    "import/no-extraneous-dependencies": "off",
  },
}
