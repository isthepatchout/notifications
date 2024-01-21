import { pino } from "pino"
import { default as PinoPretty } from "pino-pretty"

const isDev = process.env.NODE_ENV === "development"

export const Logger = pino(
  {
    level: isDev ? "debug" : "info",
    base: {
      source: "notifications",
    },
  },
  // @ts-ignore bad types
  PinoPretty({
    ignore: "source",
  }),
)
