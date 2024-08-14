import type { WebPushError } from "web-push"
import type { XiorError } from "xior"

import type { Patch, PushSubscription } from "./db/schema.js"
import { Logger } from "./logger.js"
import { queries } from "./db/db.ts"
import { Discord } from "./notifications/discord.ts"
import { Web } from "./notifications/web.ts"

type PushEventPatch = Patch & { type: "patch" }

const handleSentNotifications = async (
  endpoints: string[],
  patch: Patch,
): Promise<number> => {
  if (endpoints.length === 0) return 0

  const result = await queries.updateNotifiedSubscriptions(endpoints, patch)

  return result.length
}

export const sendNotifications = async (
  subscriptions: PushSubscription[],
  patch: Patch,
) => {
  const promises: Array<Promise<string | WebPushError | XiorError | Error>> = []

  for (const { type, endpoint, auth, extra } of subscriptions) {
    const patchData: PushEventPatch = {
      type: "patch",
      ...patch,
    }

    promises.push(
      type === "push"
        ? Web.sendNotification(endpoint, auth, extra!, patchData)
        : Discord.sendNotification(endpoint, patchData),
    )
  }

  const results = await Promise.all(promises)

  const errors = [] as Error[]
  const expiredDiscordWebhooks = [] as XiorError[]
  const expiredWebPushes = [] as WebPushError[]
  const successful = [] as string[]

  for (const result of results) {
    if (typeof result === "string") {
      successful.push(result)
    } else if ("endpoint" in result) {
      expiredWebPushes.push(result)
    } else if ("response" in result) {
      expiredDiscordWebhooks.push(result)
    } else {
      errors.push(result)
    }
  }

  Logger.info(
    {
      total: results.length,
      ok: successful.length,
      expired: expiredDiscordWebhooks.length + expiredWebPushes.length,
      errors: errors.length,
    },
    "Tried to send notifications.",
  )

  if (errors.length > 0) {
    Logger.error(errors[0], "Failed to send some notifications")
  }

  const handledCounts = await Promise.all([
    handleSentNotifications(successful, patch),
    Web.handleExpired(expiredWebPushes),
    Discord.handleExpired(expiredDiscordWebhooks),
  ] as const)

  const handledCount = handledCounts.reduce((acc, curr) => acc + curr, 0)

  if (handledCount !== subscriptions.length) {
    Logger.error(
      "A subscription's last notification was not updated as it should've been!! Pulling plug.",
    )

    process.exit(1)
  }
}
