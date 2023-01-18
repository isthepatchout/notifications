import type { RealtimePostgresInsertPayload } from "@supabase/realtime-js"

import { Logger } from "./logger"
import { sendNotifications } from "./notifications"
import { getUnnotifiedSubscriptions, supabase } from "./supabase"
import { Patch } from "./types"

const tableName = "patches" as const

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

  Logger.debug(`Found ${subscriptions.length} notifications to send.`)

  await sendNotifications(subscriptions, patch)

  return count - subscriptions.length
}

export const initListener = () => {
  Logger.info(`Listening for INSERT:s on '${tableName}'...`)

  const channel = supabase.channel(`public:${tableName}`)

  channel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "patches",
      },
      handler,
    )
    .subscribe()

  setTimeout(() => {
    console.log(channel.bindings)
  }, 1500)
}
