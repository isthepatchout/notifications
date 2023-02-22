import { $fetch, FetchError } from "ofetch/node"
import PQueue from "p-queue"
import * as WebPush from "web-push"
import { WebPushError } from "web-push"

import { captureException } from "@sentry/node"

import { Logger } from "./logger"
import {
  handleDiscordSendErrors,
  handleSentNotifications,
  handleWebPushSendErrors,
} from "./supabase"
import type { Patch, PushEventPatch, PushSubscription } from "./types"

WebPush.setGCMAPIKey(process.env.GCM_API_KEY as string)
WebPush.setVapidDetails(
  "mailto:adam@haglund.dev",
  process.env.VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string,
)

const webPushLimiter = new PQueue({
  timeout: 10_000,
  concurrency: 33,
})

const discordLimiter = new PQueue({
  timeout: 2000,
  concurrency: 25,
  interval: 500,
  intervalCap: 25,
})

const sendDiscordNotification = async (endpoint: string, patch: PushEventPatch) => {
  const buttons = patch.links.map((link) => ({
    type: 2,
    style: 5,
    label: link.includes("/patches/")
      ? "Check them out!"
      : "Check out the patch announcement!",
    url: link,
  }))

  return discordLimiter
    .add(() =>
      $fetch.raw(endpoint, {
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
    .add(() =>
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
        ? sendWebPushNotification(endpoint, auth, extra as string, patchData)
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
  const FetchErrors = results.filter(
    (result): result is FetchError => (result as FetchError).response != null,
  )
  const successful = results.filter(
    (result): result is string => typeof result === "string",
  )

  Logger.info(
    `Tried to send ${results.length} notifications. (OK: ${successful.length}, FAIL: ${
      webPushErrors.length + FetchErrors.length
    })`,
  )

  for (const error of errors) {
    captureException(
      new Error(`Failed to send notification: ${error.message}`, { cause: error }),
    )
  }

  const [updatedEndpoints] = await Promise.all([
    handleSentNotifications(successful, patch),
    handleWebPushSendErrors(webPushErrors),
    handleDiscordSendErrors(FetchErrors),
  ] as const)

  if (updatedEndpoints.length !== subscriptions.length) {
    Logger.error(
      "A subscription's last notification was not updated as it should've been!! Pulling plug.",
    )
    captureException(
      "A subscription's last notification was not updated as it should've been!! Pulling plug.",
    )
    // eslint-disable-next-line n/no-process-exit,unicorn/no-process-exit
    process.exit(1)
  }
}
