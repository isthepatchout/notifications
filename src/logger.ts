import { pino } from "pino"

const isDev = process.env.BUN_ENV === "development"

export const Logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    base: {
      source: "notifications",
    },
  },
  import.meta.env.DEV
    ? (await import("pino-pretty")).PinoPretty({ ignore: "source" })
    : undefined,
)
