import { Logger } from "./logger.ts"
import { initWatcher } from "./watcher.ts"

Logger.info("Initializing...")

await initWatcher()
