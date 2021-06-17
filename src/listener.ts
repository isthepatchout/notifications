import { SupabaseRealtimePayload } from "@supabase/supabase-js"

import { Logger } from "./logger"
import { sendNotification } from "./notifications"
import { getUnnotifiedSubscriptions, supabase } from "./supabase"
import { Patch } from "./types"

const tableName = "patches"

const handler = async (event: SupabaseRealtimePayload<Patch>) => {
  Logger.debug(event)

  if (event.old.releasedAt != null) {
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

  await sendNotification(subscriptions, patch)

  return count - subscriptions.length
}

export const initListener = () => {
  Logger.info(`Listening for UPDATE:s to '${tableName}'...`)

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  supabase.from<Patch>(tableName).on("UPDATE", handler)
}
