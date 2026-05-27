import { log } from "evlog"
import PQueue from "p-queue"
import { deserializeVapidKeys, sendPushNotification } from "web-push-browser"

import { queries } from "../db/db.ts"
import type { Patch } from "../db/schema.ts"

export type WebPushResponse =
  | { endpoint: string; response: Response; error: null }
  | { endpoint: string; response: null; error: Error }

const EMAIL = "mailto:adam+itpo@haglund.dev"
const keyPair = await deserializeVapidKeys({
  publicKey: process.env.VAPID_PUBLIC_KEY!,
  privateKey: process.env.VAPID_PRIVATE_KEY!,
})

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
): Promise<WebPushResponse> =>
  webPushLimiter
    .add(async () =>
      sendPushNotification(
        keyPair,
        { endpoint, keys: { auth, p256dh } },
        EMAIL,
        JSON.stringify(patchData),
        { algorithm: "aes128gcm", urgency: "high" },
      ),
    )
    .then((response) => ({ endpoint, response, error: null }))
    .catch((error) => ({ endpoint, response: null, error: error as Error }))

const handleExpired = async (responses: WebPushResponse[]): Promise<number> => {
  if (responses.length === 0) return 0

  log.debug({ errors: responses })

  const expired = responses.filter(({ response }) => response?.status === 410)
  const rest = responses.filter(({ response }) => response?.status !== 410)
  log.info("web", `${expired.length} Web Push subscriptions have expired.`)

  if (rest.length > 0) {
    log.error({ rest })
  }

  if (expired.length === 0) return 0

  const deletedCount = await queries.deleteSubscriptions(
    expired.map(({ endpoint }) => endpoint),
  )

  return deletedCount
}

export const Web = {
  sendNotification,
  handleExpired,
} as const
