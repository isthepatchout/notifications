import { FetchError } from "ofetch/node"
import { isTruthy } from "remeda"
import { type WebPushError } from "web-push"

import { SupabaseClient } from "@supabase/supabase-js"

import { queries } from "./db/db.js"
import { type Patch } from "./db/schema.js"
import { Logger } from "./logger.js"
import { Database } from "./types.generated.js"

export const supabase = new SupabaseClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

export const handleSentNotifications = async (
  endpoints: string[],
  patch: Patch,
): Promise<number> => {
  if (endpoints.length === 0) return 0

  const result = await queries.updateNotifiedSubscriptions(endpoints, patch)

  return result.length
}

export const handleWebPushSendErrors = async (
  errors: WebPushError[],
): Promise<number> => {
  if (errors.length === 0) return 0

  Logger.debug(errors)

  const expired = errors.filter((error) => error.statusCode === 410)
  const rest = errors.filter((error) => error.statusCode !== 410)
  Logger.info(`${expired.length} Web Push subscriptions have expired.`)

  if (rest.length > 0) {
    Logger.error(rest)
  }

  if (expired.length === 0) return 0

  const deletedCount = await queries.deleteSubscriptions(
    expired.map((error) => error.endpoint),
  )

  return deletedCount
}

export const handleDiscordSendErrors = async (errors: FetchError[]): Promise<number> => {
  if (errors.length === 0) return 0

  Logger.debug(errors)

  const expired = errors.filter((error) => error.response?.status === 404)
  const rest = errors.filter((error) => error.response?.status !== 404)
  Logger.info(`${expired.length} Discord subscriptions have expired.`)

  if (rest.length > 0) {
    Logger.error(rest)
  }

  if (expired.length === 0) return 0

  const deletedCount = await queries.deleteSubscriptions(
    expired.filter(isTruthy).map((error) => error.response!.url),
  )

  return deletedCount
}

export const getUnnotifiedSubscriptions = async (patch: Patch) => {
  const { data, count, error } = await queries.getUnnotifiedSubscriptions(patch)

  if (error) {
    throw new Error(error.message)
  }

  return { subscriptions: data, count }
}
