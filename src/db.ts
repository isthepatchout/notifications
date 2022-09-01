import Knex from "knex"
import { identity } from "remeda"

import { Logger } from "./logger"
import type { Patch, PushSubscription } from "./types"

declare module "knex/types/tables" {
  /* eslint-disable @typescript-eslint/naming-convention,@typescript-eslint/consistent-type-definitions */

  interface Tables {
    patches: Patch
    subscriptions: PushSubscription
  }

  /* eslint-enable @typescript-eslint/naming-convention */
}

export const knex = Knex({
  client: "pg",
  connection: process.env.SUPABASE_DB_URL as string,
  pool: {
    min: 0,
    max: 10,
  },
})

// Perform connection check
void knex("patches").select("id").first().then(identity)

export const queries = {
  updateNotifiedSubscriptions: async (endpoints: string[], patch: Patch) => {
    Logger.debug(
      { patch: patch.id, endpoints: endpoints.length },
      "Updating notified subscriptions...",
    )

    const result = await knex("subscriptions")
      .update({ lastNotified: patch.number }, ["endpoint"])
      .whereIn("endpoint", endpoints)
      .then((updated) => updated)

    Logger.debug({ count: result.length }, "Updated notified subscriptions...")

    return result
  },

  deleteSubscriptions: (endpoints: string[]) => {
    Logger.debug({ endpoints }, "Deleting subscriptions...")

    return knex("subscriptions").delete().whereIn("endpoint", endpoints)
  },

  getUnnotifiedSubscriptions: async (patch: Patch) => {
    Logger.debug({ patch: patch.id }, "Getting unnotified subscriptions...")

    const base = knex("subscriptions")
      .where("environment", process.env.NODE_ENV as string)
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
