import { drizzle } from "drizzle-orm/postgres-js"
import { and, count, eq, inArray, lt, sql } from "drizzle-orm/sql"
import postgres from "postgres"

import { Logger } from "../logger.js"

import { $patches, $subscriptions, type Patch } from "./schema.js"

export const pg = postgres(process.env.SUPABASE_DB_URL!)
export const db = drizzle(pg)

// Perform connection check
void db
  .select({ id: $patches.id })
  .from($patches)
  .then(() => {
    Logger.info(`Connected to db @ ${new URL(process.env.SUPABASE_DB_URL!).host}`)
  })

const getUnnotifiedSubscriptionsQuery = db
  .select()
  .from($subscriptions)
  .where(
    and(
      eq($subscriptions.environment, process.env.NODE_ENV as never),
      lt($subscriptions.lastNotified, sql.placeholder("patchNumber")),
    ),
  )
  .limit(333)
  .prepare("getUnnotifiedSubscriptions")

const getUnnotifiedSubscriptionsCountQuery = db
  .select({
    cnt: count($subscriptions.endpoint),
  })
  .from($subscriptions)
  .where(
    and(
      eq($subscriptions.environment, process.env.NODE_ENV as never),
      lt($subscriptions.lastNotified, sql.placeholder("patchNumber")),
    ),
  )
  .prepare("getUnnotifiedSubscriptionsCount")

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
      .returning({ patch: $subscriptions.lastNotified })

    Logger.debug({ count: result.length }, "Updated notified subscriptions...")

    return result
  },

  deleteSubscriptions: async (endpoints: string[]) => {
    Logger.debug({ endpoints }, "Deleting subscriptions...")

    const result = await db
      .delete($subscriptions)
      .where(inArray($subscriptions.endpoint, endpoints))
      .returning({ patch: $subscriptions.lastNotified })

    return result.length
  },

  getUnnotifiedSubscriptions: async (patch: Patch) => {
    Logger.debug({ patch: patch.id }, "Getting unnotified subscriptions...")

    const rows = await getUnnotifiedSubscriptionsQuery
      .execute({ patchNumber: patch.number })
      .catch((error) => error as Error)

    const countResults = await getUnnotifiedSubscriptionsCountQuery
      .execute({ patchNumber: patch.number })
      .catch((error) => error as Error)

    if (rows instanceof Error || countResults instanceof Error) {
      const error = (rows instanceof Error ? rows : countResults) as Error
      Logger.error(error, "Failed to get unnotified subscriptions.")

      return {
        data: null,
        count: null,
        error,
      }
    }

    Logger.debug(
      { cnt: countResults[0]!.cnt, rows: rows.slice(0, 5) },
      "Got unnotified subscriptions.",
    )
    return {
      data: rows,
      count: countResults[0]!.cnt,
      error: null,
    }
  },
}
