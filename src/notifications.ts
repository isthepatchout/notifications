import * as WebPush from "web-push"
import { WebPushError } from "web-push"

import { Patch, PushEventPatch, PushSubscription } from "../src/types"

import { Logger } from "./logger"
import { handleSendErrors, handleSentNotifications } from "./supabase"

WebPush.setGCMAPIKey(process.env.GCM_API_KEY as string)
WebPush.setVapidDetails(
  "mailto:adam@haglund.dev",
  process.env.VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string,
)

const isTruthy = <T>(input: T | false | null | undefined): input is T => !!input

export const sendNotification = async (
  subscriptions: PushSubscription[],
  patch: Patch,
) => {
  const results = await Promise.allSettled(
    subscriptions.map(async ({ endpoint, auth, p256dh }) => {
      const patchData: PushEventPatch = {
        type: "patch",
        ...patch,
      }

      return WebPush.sendNotification(
        {
          endpoint,
          keys: { auth, p256dh },
        },
        JSON.stringify(patchData),
      )
    }),
  )

  const failed = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason as WebPushError)
  const successful = subscriptions.filter(
    ({ endpoint }) => !failed.some((error) => error.endpoint === endpoint),
  )

  Logger.info(
    `Tried to send ${results.length} notifications. (OK: ${successful.length}, FAIL: ${failed.length})`,
  )

  await Promise.all(
    [
      handleSentNotifications(successful, patch),
      failed.length > 0 && handleSendErrors(failed),
    ].filter(isTruthy),
  )
}
