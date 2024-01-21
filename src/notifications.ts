import { $fetch, FetchError } from "ofetch/node"
import PQueue from "p-queue"
import WebPush, { WebPushError } from "web-push"

import type { Patch, PushSubscription } from "./db/schema.js"
import { Logger } from "./logger.js"
import {
  handleDiscordSendErrors,
  handleSentNotifications,
  handleWebPushSendErrors,
} from "./supabase.js"

type PushEventPatch = Patch & { type: "patch" }

WebPush.setGCMAPIKey(process.env.GCM_API_KEY!)
WebPush.setVapidDetails(
  "mailto:adam@haglund.dev",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

const webPushLimiter = new PQueue({
  timeout: 10_000,
  concurrency: 100,
})

const discordLimiter = new PQueue({
  timeout: 2000,
  concurrency: 50,
  interval: 1000,
  intervalCap: 49,
})

const sendDiscordNotification = async (endpoint: string, patch: PushEventPatch) => {
  const buttons = patch.links.map((link) => ({
    type: 2,
    style: 5,
    label: link.includes("/patches/")
      ? "Check out the patch notes!"
      : "Check out the patch announcement!",
    url: link,
  }))

  return discordLimiter
    .add(
      () =>
        $fetch.raw(endpoint, {
          responseType: "json",
          method: "POST",
          body: {
            content: `**The ${patch.id} patch notes have been released!**`,
            components: [
              {
                type: 1,
                components: buttons,
              },
            ],
          },
        }),
      { throwOnTimeout: true },
    )
    .then(() => endpoint)
    .catch((error: FetchError | Error) => error)
}

const sendWebPushNotification = async (
  endpoint: string,
  auth: string,
  p256dh: string,
  patchData: PushEventPatch,
) =>
  webPushLimiter
    .add(
      () =>
        WebPush.sendNotification(
          {
            endpoint,
            keys: { auth, p256dh },
          },
          JSON.stringify(patchData),
        ),
      { throwOnTimeout: true },
    )
    .then(() => endpoint)
    .catch((error) => error as WebPushError | Error)

export const sendNotifications = async (
  subscriptions: PushSubscription[],
  patch: Patch,
) => {
  const promises: Array<Promise<string | WebPushError | FetchError | Error>> = []

  for (const { type, endpoint, auth, extra } of subscriptions) {
    const patchData: PushEventPatch = {
      type: "patch",
      ...patch,
    }

    promises.push(
      type === "push"
        ? sendWebPushNotification(endpoint, auth, extra!, patchData)
        : sendDiscordNotification(endpoint, patchData),
    )
  }

  const results = await Promise.all(promises)

  const errors = results.filter(
    (result): result is WebPushError =>
      result instanceof Error && (result as WebPushError).statusCode == null,
  )
  const webPushErrors = results.filter(
    (result): result is WebPushError => result instanceof WebPushError,
  )
  const fetchErrors = results.filter(
    (result): result is FetchError => (result as FetchError).response != null,
  )
  const successful = results.filter(
    (result): result is string => typeof result === "string",
  )

  Logger.info(
    `Tried to send ${results.length} notifications. (OK: ${successful.length}, FAIL: ${
      webPushErrors.length + fetchErrors.length
    })`,
  )

  if (errors.length > 0) {
    Logger.error(errors, "Failed to send some notifications")
  }

  const successfulHandlingCounts = await Promise.all([
    handleSentNotifications(successful, patch),
    handleWebPushSendErrors(webPushErrors),
    handleDiscordSendErrors(fetchErrors),
  ] as const)

  const successCount = successfulHandlingCounts.reduce((acc, curr) => acc + curr, 0)

  if (successCount !== subscriptions.length) {
    Logger.error(
      "A subscription's last notification was not updated as it should've been!! Pulling plug.",
    )
    // eslint-disable-next-line n/no-process-exit,unicorn/no-process-exit
    process.exit(1)
  }
}
