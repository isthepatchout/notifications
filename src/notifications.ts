import Bottleneck from "bottleneck"
import * as WebPush from "web-push"
import { WebPushError } from "web-push"

import { captureException } from "@sentry/node"

import { Patch, PushEventPatch, PushSubscription } from "../src/types"

import { Logger } from "./logger"
import { handleSendErrors, handleSentNotifications } from "./supabase"

WebPush.setGCMAPIKey(process.env.GCM_API_KEY as string)
WebPush.setVapidDetails(
  "mailto:adam@haglund.dev",
  process.env.VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string,
)

const pushLimiter = new Bottleneck({
  maxConcurrent: 50,
})

const isTruthy = <T>(input: T | false | null | undefined): input is T => !!input

export const sendNotification = async (
  subscriptions: PushSubscription[],
  patch: Patch,
) => {
  const promises: Array<Promise<string | WebPushError | Error>> = []

  for (const { endpoint, auth, p256dh } of subscriptions) {
    const patchData: PushEventPatch = {
      type: "patch",
      ...patch,
    }

    promises.push(
      pushLimiter
        .schedule({ expiration: 10_000 }, () =>
          WebPush.sendNotification(
            {
              endpoint,
              keys: { auth, p256dh },
            },
            JSON.stringify(patchData),
          ),
        )
        .then(() => endpoint)
        .catch((error) => error as WebPushError | Error),
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
  const successful = results.filter(
    (result): result is string => typeof result === "string",
  )

  Logger.info(
    `Tried to send ${results.length} notifications. (OK: ${successful.length}, FAIL: ${webPushErrors.length})`,
  )

  for (const error of errors) {
    captureException(new Error(`Failed to send notification: ${error.message}`))
  }

  await Promise.all(
    [
      successful.length > 0 && handleSentNotifications(successful, patch),
      webPushErrors.length > 0 && handleSendErrors(webPushErrors),
    ].filter(isTruthy),
  )
}
