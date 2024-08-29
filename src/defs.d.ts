declare namespace NodeJS {
  interface ProcessEnv {
    BUN_ENV: string
    DEV: boolean
    PROD: boolean
    TEST: boolean
  }
}
