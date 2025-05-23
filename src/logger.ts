import { pino } from "pino"

const isProd = process.env.BUN_ENV === "production"

export const Logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
    base: {
      source: "notifications",
    },
  },
  !import.meta.env.PROD
    ? (await import("pino-pretty")).PinoPretty({ ignore: "source" })
    : undefined,
)
