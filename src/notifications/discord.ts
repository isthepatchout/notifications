import { createLimiter } from "alleviate"
import { log } from "evlog"
import xior, { type XiorError } from "xior"

import { queries } from "../db/db.ts"
import type { Patch } from "../db/schema.ts"

type PushEventPatch = Patch & { type: "patch" }

const discordLimiter = createLimiter({
  concurrency: 50,
  refill: 24,
  refillInterval: 500,
  timeout: 10_000,
})

const sendNotification = async (endpoint: string, patch: PushEventPatch) => {
  const buttons = patch.links.map((link) => ({
    type: 2,
    style: 5,
    label: link.includes("/patches/")
      ? "Check out the patch notes!"
      : "Check out the patch announcement!",
    url: link,
  }))

  return discordLimiter
    .run(async () =>
      xior.post(
        endpoint,
        {
          content: `**The ${patch.id} patch notes have been released!**`,
          components: [
            {
              type: 1,
              components: buttons,
            },
          ],
        },
        { responseType: "json" },
      ),
    )
    .then(() => endpoint)
    .catch((error: XiorError | Error) => error)
}

const handleExpired = async (errors: XiorError[]): Promise<number> => {
  if (errors.length === 0) return 0

  log.debug({ errors })

  const expired = errors.filter((error) => error.response?.status === 404)
  const rest = errors.filter((error) => error.response?.status !== 404)
  log.info("discord", `${expired.length} Discord subscriptions have expired.`)

  if (rest.length > 0) {
    log.error({ rest })
  }

  if (expired.length === 0) return 0

  const deletedCount = await queries.deleteSubscriptions(
    expired.filter(Boolean).map((error) => error.request!.url!),
  )

  return deletedCount
}

export const Discord = {
  sendNotification,
  handleExpired,
} as const
