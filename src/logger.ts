import { pino } from "pino"

const isProd = process.env.NODE_ENV === "production"

export const Logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
    base: {
      source: "notifications",
    },
  },
  !process.env.PROD
    ? (await import("pino-pretty")).PinoPretty({ ignore: "source" })
    : undefined,
)
