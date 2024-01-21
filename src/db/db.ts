import { drizzle } from "drizzle-orm/postgres-js"
import { and, count, eq, inArray, lt } from "drizzle-orm/sql"
import postgres from "postgres"

import { Logger } from "../logger.js"
import type { Patch } from "../types.js"

import { $patches, $subscriptions } from "./schema.js"

export const pg = postgres(process.env.SUPABASE_DB_URL!)
export const db = drizzle(pg)

// Perform connection check
void db
  .select({ id: $patches.id })
  .from($patches)
  .then(() => {
    Logger.info(`Connected to db @ ${new URL(process.env.SUPABASE_DB_URL!).host}`)
  })

export const queries = {
  updateNotifiedSubscriptions: async (endpoints: string[], patch: Patch) => {
    Logger.debug(
      { patch: patch.id, endpoints: endpoints.length },
      "Updating notified subscriptions...",
    )

    const result = await db
      .update($subscriptions)
      .set({ lastNotified: patch.number })
      .where(inArray($subscriptions.endpoint, endpoints))
      .then((updated) => updated)

    Logger.debug({ count: result.length }, "Updated notified subscriptions...")

    return result
  },

  deleteSubscriptions: (endpoints: string[]) => {
    Logger.debug({ endpoints }, "Deleting subscriptions...")

    return db.delete($subscriptions).where(inArray($subscriptions.endpoint, endpoints))
  },

  getUnnotifiedSubscriptions: async (patch: Patch) => {
    Logger.debug({ patch: patch.id }, "Getting unnotified subscriptions...")

    const rows = await db
      .select()
      .from($subscriptions)
      .where(
        and(
          eq($subscriptions.environment, process.env.NODE_ENV as never),
          lt($subscriptions.lastNotified, patch.number),
        ),
      )
      .limit(333)
      .catch((error) => error as Error)

    const countResults = await db
      .select({
        cnt: count($subscriptions.endpoint),
      })
      .from($subscriptions)
      .where(
        and(
          eq($subscriptions.environment, process.env.NODE_ENV as never),
          lt($subscriptions.lastNotified, patch.number),
        ),
      )
      .catch((error) => error as Error)

    if (rows instanceof Error || countResults instanceof Error) {
      Logger.error(
        rows instanceof Error ? rows : countResults,
        "Failed to get unnotified subscriptions.",
      )

      return {
        data: null,
        count: null,
        error: rows,
      }
    }

    Logger.debug({ cnt: countResults[0]!.cnt, rows }, "Got unnotified subscriptions.")
    return {
      data: rows,
      count: countResults[0]!.cnt,
      error: null,
    }
  },
}
