import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
} from "@supabase/realtime-js"

import type { Patch } from "./db/schema.js"
import { Logger } from "./logger.js"
import { sendNotifications } from "./notifications.js"
import { getUnnotifiedSubscriptions, supabase } from "./supabase.js"

const table = "patches" as const

const handler = async (event: RealtimePostgresInsertPayload<Patch>) => {
  Logger.info(event, "New patch was inserted")

  if ((event.old as Patch | null)?.releasedAt != null) {
    return Logger.info(`Dismissing update to '${event.new.id}' - was already released.`)
  }

  Logger.info(`'${event.new.id}' was just released!`)

  let remaining = Number.POSITIVE_INFINITY
  do {
    remaining = await sendNotificationsInBatches(event.new)
  } while (remaining > 1)
}

const sendNotificationsInBatches = async (patch: Patch): Promise<number> => {
  const { count, subscriptions } = await getUnnotifiedSubscriptions(patch)

  Logger.debug(`Found ${subscriptions?.length ?? 0} notifications to send.`)
  if (subscriptions == null) {
    return 0
  }

  await sendNotifications(subscriptions, patch)

  return count - subscriptions.length
}

export const initListener = (): RealtimeChannel => {
  Logger.info(`Listening for INSERT:s on '${table}'...`)

  const channel = supabase.channel(`public:${table}`)

  channel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table,
      },
      handler,
    )
    .subscribe()

  setTimeout(() => {
    Logger.info({ state: channel.state }, "Realtime")
  }, 2500)

  return channel
}
