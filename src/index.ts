import "./config.ts"
import { Logger } from "./logger.js"
import { initWatcher } from "./watcher.ts"

Logger.info("Initializing...")

await initWatcher()
