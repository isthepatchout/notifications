import { log } from "evlog"
import PQueue from "p-queue"
import WebPush, { type WebPushError } from "web-push"

import { queries } from "../db/db.ts"
import type { Patch } from "../db/schema.ts"

if (process.env.NODE_ENV !== "test") {
  WebPush.setGCMAPIKey(process.env.GCM_API_KEY!)
  WebPush.setVapidDetails(
    "mailto:adam@haglund.dev",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
}

type PushEventPatch = Patch & { type: "patch" }

const webPushLimiter = new PQueue({
  timeout: 10_000,
  concurrency: 100,
})

const sendNotification = async (
  endpoint: string,
  auth: string,
  p256dh: string,
  patchData: PushEventPatch,
) =>
  webPushLimiter
    .add(async () =>
      WebPush.sendNotification(
        {
          endpoint,
          keys: { auth, p256dh },
        },
        JSON.stringify(patchData),
      ),
    )
    .then(() => endpoint)
    .catch((error) => error as WebPushError | Error)

const handleExpired = async (errors: WebPushError[]): Promise<number> => {
  if (errors.length === 0) return 0

  log.debug({ errors })

  const expired = errors.filter((error) => error.statusCode === 410)
  const rest = errors.filter((error) => error.statusCode !== 410)
  log.info("web", `${expired.length} Web Push subscriptions have expired.`)

  if (rest.length > 0) {
    log.error({ rest })
  }

  if (expired.length === 0) return 0

  const deletedCount = await queries.deleteSubscriptions(
    expired.map((error) => error.endpoint),
  )

  return deletedCount
}

export const Web = {
  sendNotification,
  handleExpired,
} as const
