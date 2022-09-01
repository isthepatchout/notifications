import Knex from "knex"

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

export const queries = {
  sanityCheck: (endpoints: string[], patch: Patch) =>
    knex("subscriptions")
      .count("lastNotified")
      .whereIn("endpoint", endpoints)
      .where({ lastNotified: patch.number })
      .first()
      .then((data) => ({
        count: Number((data as { count: string })?.count),
        error: null,
      }))
      .catch((error: Error) => ({ count: null, error })),
}
