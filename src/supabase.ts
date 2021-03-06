import { AxiosError } from "axios"
import { WebPushError } from "web-push"

import { SupabaseClient } from "@supabase/supabase-js"

import { Logger } from "./logger"
import { Patch, PatchSubscription } from "./types"

export const supabase = new SupabaseClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string,
)

export const handleSentNotifications = async (endpoints: string[], patch: Patch) => {
  await supabase
    .from<PatchSubscription>("subscriptions")
    .update({ lastNotified: patch.number })
    .in("endpoint", endpoints)
}

export const handleWebPushSendErrors = async (errors: WebPushError[]) => {
  Logger.debug(errors)

  const expired = errors.filter((error) => error.statusCode === 410)
  const rest = errors.filter((error) => error.statusCode !== 410)
  Logger.info(`${expired.length} Web Push subscriptions have expired.`)

  await supabase
    .from<PatchSubscription>("subscriptions")
    .delete()
    .in(
      "endpoint",
      expired.map((error) => error.endpoint),
    )

  if (rest.length > 0) {
    Logger.error(rest)
  }
}

export const handleDiscordSendErrors = async (errors: AxiosError[]) => {
  Logger.debug(errors)

  const expired = errors.filter((error) => error.response?.status === 404)
  const rest = errors.filter((error) => error.response?.status !== 404)
  Logger.info(`${expired.length} Discord subscriptions have expired.`)

  await supabase
    .from<PatchSubscription>("subscriptions")
    .delete()
    .in(
      "endpoint",
      expired.filter(Boolean).map((error) => error.config.url!),
    )

  if (rest.length > 0) {
    Logger.error(rest)
  }
}

export const getUnnotifiedSubscriptions = async (patch: Patch) => {
  const { data, error, count } = await supabase
    .from<PatchSubscription>("subscriptions")
    .select("*", { count: "exact" })
    .eq("environment", process.env.NODE_ENV as string)
    .lt("lastNotified", patch.number)
    .limit(500)

  if (error) {
    throw new Error(error.message)
  }

  return { subscriptions: data!, count: count! }
}
