import Axios, { AxiosError } from "axios"
import PQueue from "p-queue"
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

const isTruthy = <T>(input: T | false | null | undefined): input is T => !!input

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
      Axios.post(endpoint, {
        content: `**${patch.id} has been released!**\n_Apologies for the delay in notifaction due to misconfiguration._`,
        components: [
          {
            type: 1,
            components: buttons,
          },
        ],
      }),
    )
    .then(() => endpoint)
    .catch((error: AxiosError | Error) => error)
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
  const promises: Array<Promise<string | WebPushError | AxiosError | Error>> = []

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
  const axiosErrors = results.filter(
    (result): result is AxiosError => (result as AxiosError).isAxiosError,
  )
  const successful = results.filter(
    (result): result is string => typeof result === "string",
  )

  Logger.info(
    `Tried to send ${results.length} notifications. (OK: ${successful.length}, FAIL: ${
      webPushErrors.length + axiosErrors.length
    })`,
  )

  for (const error of errors) {
    captureException(new Error(`Failed to send notification: ${error.message}`))
  }

  await Promise.all(
    [
      successful.length > 0 && handleSentNotifications(successful, patch),
      webPushErrors.length > 0 && handleWebPushSendErrors(webPushErrors),
      axiosErrors.length > 0 && handleDiscordSendErrors(axiosErrors),
    ].filter(isTruthy),
  )
}
