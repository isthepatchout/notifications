import Pino from "pino"
import pretty from "pino-pretty"

const isDev = process.env.NODE_ENV === "development"

export const Logger = Pino(
  {
    level: isDev ? "debug" : "info",
    base: {
      source: "notifications",
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  isDev
    ? pretty({
        colorize: true,
        ignore: "source",
      })
    : (undefined as any),
)
