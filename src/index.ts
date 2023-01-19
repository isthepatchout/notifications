import "./config"
import "./sentry"

import { initListener } from "./listener"
import { Logger } from "./logger"

Logger.info("Initializing...")

void initListener()
