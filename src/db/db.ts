import { drizzle } from "drizzle-orm/postgres-js"
import { and, count, desc, eq, inArray, lt, sql } from "drizzle-orm/sql"
import postgres from "postgres"

import { Logger } from "../logger.js"

import { $patches, $subscriptions, type Patch } from "./schema.js"

export const pg = postgres(
  process.env.BUN_ENV !== "test"
    ? process.env.SUPABASE_DB_URL!
    : "postgresql://postgres:postgres@localhost:5432/postgres",
)
export const db = drizzle(pg)

// Perform connection check
void db
  .select({ id: $patches.id })
  .from($patches)
  .then(() => {
    Logger.info(`Connected to db @ ${new URL(process.env.SUPABASE_DB_URL!).host}`)
  })

const getLatestPatchQuery = db
  .select()
  .from($patches)
  .orderBy(desc($patches.number))
  .limit(1)
  .prepare("getLatestPatch")

const getUnnotifiedSubscriptionsQuery = db
  .select()
  .from($subscriptions)
  .where(
    and(
      eq($subscriptions.environment, process.env.BUN_ENV as never),
      lt($subscriptions.lastNotified, sql.placeholder("patchNumber")),
    ),
  )
  .limit(1000)
  .orderBy($subscriptions.createdAt)
  .prepare("getUnnotifiedSubscriptions")

const getUnnotifiedSubscriptionsCountQuery = db
  .select({
    cnt: count($subscriptions.endpoint),
  })
  .from($subscriptions)
  .where(
    and(
      eq($subscriptions.environment, process.env.BUN_ENV as never),
      lt($subscriptions.lastNotified, sql.placeholder("patchNumber")),
    ),
  )
  .prepare("getUnnotifiedSubscriptionsCount")

export const queries = {
  getLatestPatch: async () => {
    Logger.debug("Getting latest patch...")

    const rows = await getLatestPatchQuery.execute().catch((error) => error as Error)

    if (rows instanceof Error) {
      // eslint-disable-next-line unicorn/prefer-type-error
      throw new Error("Failed to get latest patch.", { cause: rows })
    }

    if (rows.length === 0) {
      throw new Error("No patches found.")
    }

    const patch = rows[0]!
    Logger.debug({ patch: patch.id }, "Got latest patch.")
    return patch
  },

  updateNotifiedSubscriptions: async (endpoints: string[], patch: Patch) => {
    Logger.debug(
      { patch: patch.id, endpoints: endpoints.length },
      "Updating notified subscriptions...",
    )

    const result = await db
      .update($subscriptions)
      .set({ lastNotified: patch.number })
      .where(inArray($subscriptions.endpoint, endpoints))
      .returning({
        endpoint: $subscriptions.endpoint,
        lastNotified: $subscriptions.lastNotified,
      })

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

    Logger.debug({ count: countResults[0]!.cnt }, "Got unnotified subscriptions.")
    return {
      data: rows,
      count: countResults[0]!.cnt,
      error: null,
    }
  },
}
