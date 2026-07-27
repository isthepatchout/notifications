import { createLimiter } from "alleviate"
import { log } from "evlog"
import WebPush, { WebPushError } from "web-push"

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

const webPushLimiter = createLimiter({
  concurrency: 100,
  refill: 50,
  refillInterval: 500,
  timeout: 10_000,
})

const sendNotification = async (
  endpoint: string,
  auth: string,
  p256dh: string,
  patchData: PushEventPatch,
) =>
  webPushLimiter
    .run(async () => {
      const details = WebPush.generateRequestDetails(
        { endpoint, keys: { auth, p256dh } },
        JSON.stringify(patchData),
      )

      const response = await fetch(details.endpoint, {
        method: "POST",
        headers: details.headers as Record<string, string>,
        // oxlint-disable-next-line typescript/no-unnecessary-condition
        body: details.body ?? null,
      })

      if (!response.ok) {
        throw new WebPushError(
          `Request failed with status code ${response.status}`,
          response.status,
          Object.fromEntries(response.headers.entries()),
          await response.text(),
          endpoint,
        )
      }
    })
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

  const deletedCount = await queries.deleteSubscriptions(expired.map((error) => error.endpoint))

  return deletedCount
}

export const Web = {
  sendNotification,
  handleExpired,
} as const
