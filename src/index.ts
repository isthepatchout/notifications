import { initLogger, log } from "evlog"

import { initWatcher } from "./watcher.ts"

initLogger()
log.info("startup", "Initializing...")

await initWatcher()
