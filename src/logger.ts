import Pino from "pino"
import { createWriteStream } from "pino-logflare"
import pretty from "pino-pretty"

const isDev = process.env.NODE_ENV === "development"

export const Logger = Pino(
  {
    level: isDev ? "debug" : "info",
    base: {
      source: "notifications",
    },
  },
  !isDev
    ? createWriteStream({
        apiKey: process.env.LOGFLARE_API_KEY!,
        sourceToken: "a1bdc121-06ff-49ed-af26-5295a039d8f8",
      })
    : pretty({
        colorize: true,
        ignore: "source",
      }),
)
