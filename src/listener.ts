import { Logger } from "./logger"
import { sendNotifications } from "./notifications"
import { getUnnotifiedSubscriptions, supabase } from "./supabase"
import { Patch, RealtimeChange } from "./types"

const tableName = "patches" as const

const handler = async (event: RealtimeChange<typeof tableName>) => {
  Logger.debug(event)

  if (event.old_record?.releasedAt != null) {
    return Logger.info(
      `Dismissing update to '${event.record!.id}' - was already released.`,
    )
  }

  Logger.info(`'${event.record!.id}' was just released!`)

  let remaining = Number.POSITIVE_INFINITY
  do {
    remaining = await sendNotificationsInBatches(event.record!)
  } while (remaining > 1)
}

const sendNotificationsInBatches = async (patch: Patch): Promise<number> => {
  const { count, subscriptions } = await getUnnotifiedSubscriptions(patch)

  Logger.debug(`Found ${subscriptions.length} notifications to send.`)

  await sendNotifications(subscriptions, patch)

  return count - subscriptions.length
}

export const initListener = () => {
  Logger.info(`Listening for UPDATE:s to '${tableName}'...`)

  const channel = supabase.channel(`public:${tableName}`)

  channel
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "patches",
      },
      handler,
    )
    .subscribe()
}
