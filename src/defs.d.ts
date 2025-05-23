declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string
    DEV: boolean
    PROD: boolean
    TEST: boolean
  }
}
