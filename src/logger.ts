import { pino } from "pino"
// eslint-disable-next-line import/no-named-default
import { default as PinoPretty } from "pino-pretty"

const isDev = process.env.BUN_ENV === "development"

export const Logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    base: {
      source: "notifications",
    },
  },
  PinoPretty({ ignore: "source" }),
)
