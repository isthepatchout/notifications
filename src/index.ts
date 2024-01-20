import "./config.js"
import "./sentry.js"

import { initListener } from "./listener.js"
import { Logger } from "./logger.js"

Logger.info("Initializing...")

void initListener()
