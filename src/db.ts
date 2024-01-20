import { knex } from "knex"

import { Logger } from "./logger.js"
import type { Patch, PushSubscription } from "./types.js"

export const db = knex({
  client: "pg",
  connection: process.env.SUPABASE_DB_URL!,
  pool: {
    min: 0,
    max: 10,
  },
})

// Perform connection check
void db<Patch>("patches")
  .select("id")
  .first()
  .then(() => {
    Logger.info(`Connected to db @ ${new URL(process.env.SUPABASE_DB_URL!).host}`)
  })

export const queries = {
  updateNotifiedSubscriptions: async (endpoints: string[], patch: Patch) => {
    Logger.debug(
      { patch: patch.id, endpoints: endpoints.length },
      "Updating notified subscriptions...",
    )

    const result = await db<PushSubscription>("subscriptions")
      .update({ lastNotified: patch.number }, ["endpoint"])
      .whereIn("endpoint", endpoints)
      .then((updated) => updated)

    Logger.debug({ count: result.length }, "Updated notified subscriptions...")

    return result
  },

  deleteSubscriptions: (endpoints: string[]) => {
    Logger.debug({ endpoints }, "Deleting subscriptions...")

    return db<PushSubscription>("subscriptions").delete().whereIn("endpoint", endpoints)
  },

  getUnnotifiedSubscriptions: async (patch: Patch) => {
    Logger.debug({ patch: patch.id }, "Getting unnotified subscriptions...")

    const base = db<PushSubscription>("subscriptions")
      .where("environment", process.env.NODE_ENV!)
      .andWhere("lastNotified", "<", patch.number)

    const { data: rows, error: rowsError } = await base
      .select()
      .limit(333)
      .then((data) => ({
        data,
        error: null,
      }))
      .catch((error: Error) => ({ data: null, error }))

    const { count, error: countError } = await base
      .count()
      .first()
      .then((data) => ({
        count: Number((data as { count: string })?.count),
        error: null,
      }))
      .catch((error: Error) => ({ count: null, error }))

    if (rowsError != null || countError != null) {
      Logger.error(rowsError ?? countError, "Failed to get unnotified subscriptions.")

      return {
        data: null,
        count: null,
        error: rowsError ?? countError,
      }
    }

    Logger.debug({ count, rows: rows.length }, "Got unnotified subscriptions.")
    return {
      data: rows,
      count,
      error: null,
    }
  },
}
