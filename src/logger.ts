import { pino } from "pino"
// eslint-disable-next-line import/no-named-default
import { default as PinoPretty } from "pino-pretty"

const isDev = process.env.NODE_ENV === "development"

export const Logger = pino(
  {
    level: isDev ? "debug" : "info",
    base: {
      source: "notifications",
    },
  },
  // @ts-expect-error bad types
  // eslint-disable-next-line ts/no-unsafe-argument
  PinoPretty({
    ignore: "source",
  }),
)
