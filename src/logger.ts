import { pino } from "pino"
import { PinoPretty } from "pino-pretty"

const isDev = process.env.NODE_ENV === "development"

export const Logger = pino(
  {
    level: isDev ? "debug" : "info",
    base: {
      source: "notifications",
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  PinoPretty({
    ignore: "source",
  }),
)
