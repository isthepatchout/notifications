import { queries } from "./db/db.js"
import { Logger } from "./logger.js"
import { sendNotificationsInBatches } from "./notifications.ts"

export const initWatcher = async () => {
  let watching = true
  let latestPatch = await queries.getLatestPatch()

  Logger.info({ patch: latestPatch }, "Watching for new patches...")

  // eslint-disable-next-line ts/no-misused-promises
  setInterval(async () => {
    if (!watching) return

    const incoming = await queries.getLatestPatch()
    if (incoming.number <= latestPatch.number) return

    Logger.info({ patch: incoming.id }, "A new patch was found!")
    latestPatch = incoming
    watching = false

    await sendNotificationsInBatches(incoming)

    watching = true
  })
}
