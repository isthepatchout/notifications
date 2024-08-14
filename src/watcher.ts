import { setTimeout } from "node:timers/promises"
import { queries } from "./db/db.js"
import { Logger } from "./logger.js"
import { sendNotifications } from "./notifications.ts"

export const initWatcher = async () => {
  while (true) {
    try {
      const latestPatch = await queries.getLatestPatch()
      const {
        error,
        data: subs,
        count,
      } = await queries.getUnnotifiedSubscriptions(latestPatch)
      if (error != null) throw error

      if (count === 0) {
        Logger.info("No unnotified subscriptions found.")

        await setTimeout(2000)
        continue
      }

      Logger.info({ count }, "Unnotified subscriptions found!")
      await sendNotifications(subs, latestPatch)
    } catch (error) {
      Logger.error(error)
      await setTimeout(10_000)
    }
  }
}