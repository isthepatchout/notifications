import Pino from "pino"

export const Logger = Pino({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  prettyPrint: process.env.NODE_ENV === "development",
})
