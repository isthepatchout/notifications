import { mande, MandeError } from "mande"
import PQueue from "p-queue"
import { isTruthy } from "remeda"
import * as WebPush from "web-push"
import { WebPushError } from "web-push"

import { captureException } from "@sentry/node"

import { Logger } from "./logger"
import {
  handleWebPushSendErrors,
  handleSentNotifications,
  handleDiscordSendErrors,
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
      ? "Check out the patch notes!"
      : "Check out the patch website!",
    url: link,
  }))

  return discordLimiter
    .add(() =>
      mande(endpoint).post({
        content: `**${patch.id} has been released!**`,
        components: [
          {
            type: 1,
            components: buttons,
          },
        ],
      }),
    )
    .then(() => endpoint)
    .catch((error: MandeError | Error) => error)
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
  const promises: Array<Promise<string | WebPushError | MandeError | Error>> = []

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
  const mandeErrors = results.filter(
    (result): result is MandeError => (result as MandeError).response != null,
  )
  const successful = results.filter(
    (result): result is string => typeof result === "string",
  )

  Logger.info(
    `Tried to send ${results.length} notifications. (OK: ${successful.length}, FAIL: ${
      webPushErrors.length + mandeErrors.length
    })`,
  )

  for (const error of errors) {
    captureException(
      new Error(`Failed to send notification: ${error.message}`, { cause: error }),
    )
  }

  await Promise.all(
    [
      successful.length > 0 && handleSentNotifications(successful, patch),
      webPushErrors.length > 0 && handleWebPushSendErrors(webPushErrors),
      mandeErrors.length > 0 && handleDiscordSendErrors(mandeErrors),
    ].filter(isTruthy),
  )
}
