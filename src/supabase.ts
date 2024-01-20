import { FetchError } from "ofetch/node"
import { isTruthy } from "remeda"
import WebPush from "web-push"

import Supa from "@supabase/supabase-js"

import { queries } from "./db.js"
import { Logger } from "./logger.js"
import { Database, Patch } from "./types.js"

export const supabase = new Supa.SupabaseClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

export const handleSentNotifications = async (endpoints: string[], patch: Patch) => {
  if (endpoints.length === 0) return []

  return await queries.updateNotifiedSubscriptions(endpoints, patch)
}

export const handleWebPushSendErrors = async (errors: WebPush.WebPushError[]) => {
  if (errors.length === 0) return

  Logger.debug(errors)

  const expired = errors.filter((error) => error.statusCode === 410)
  const rest = errors.filter((error) => error.statusCode !== 410)
  Logger.info(`${expired.length} Web Push subscriptions have expired.`)

  await queries.deleteSubscriptions(expired.map((error) => error.endpoint))

  if (rest.length > 0) {
    Logger.error(rest)
  }
}

export const handleDiscordSendErrors = async (errors: FetchError[]) => {
  if (errors.length === 0) return

  Logger.debug(errors)

  const expired = errors.filter((error) => error.response?.status === 404)
  const rest = errors.filter((error) => error.response?.status !== 404)
  Logger.info(`${expired.length} Discord subscriptions have expired.`)

  await queries.deleteSubscriptions(
    expired.filter(isTruthy).map((error) => error.response!.url),
  )

  if (rest.length > 0) {
    Logger.error(rest)
  }
}

export const getUnnotifiedSubscriptions = async (patch: Patch) => {
  const { data, count, error } = await queries.getUnnotifiedSubscriptions(patch)

  if (error) {
    throw new Error(error.message)
  }

  return { subscriptions: data, count }
}
