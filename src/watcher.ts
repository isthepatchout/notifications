import { setTimeout } from "node:timers/promises"

import { createLogger } from "evlog"

import { queries } from "./db/db.ts"
import { sendNotifications } from "./notifications.ts"

const log = createLogger()

const watcher = async () => {
  try {
    const latestPatch = await queries.getLatestPatch()
    const {
      error,
      data: subs,
      count,
    } = await queries.getUnnotifiedSubscriptions(latestPatch)
    if (error != null) throw error

    if (count === 0) {
      log.info("No unnotified subscriptions found.")

      await setTimeout(2000)
      return
    }

    log.info("Unnotified subscriptions found!", { count })
    await sendNotifications(subs, latestPatch)
  } catch (error) {
    log.error(error as Error)
    await setTimeout(10_000)
  }
}

export const initWatcher = async () => {
  while (true) {
    await watcher()
  }
}
