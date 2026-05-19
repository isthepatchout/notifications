import { log } from "evlog"
import { Kysely } from "kysely"
import { PostgresJSDialect } from "kysely-postgres-js"
import postgres from "postgres"

import type { Patch, PushSubscription } from "./schema.ts"

type Database = {
  patches: Patch
  subscriptions: PushSubscription
}

export const pg = postgres(process.env.DATABASE_URL!)
export const db = new Kysely<Database>({
  dialect: new PostgresJSDialect({
    postgres: pg,
  }),
})

// Perform connection check
const checkConnection = async () => {
  await db.selectFrom("patches").limit(1).execute()

  log.info("db", `Connected to db @ ${new URL(process.env.DATABASE_URL!).host}`)
}

await checkConnection()

export const getLatestPatchQuery = db
  .selectFrom("patches")
  .selectAll()
  .orderBy("number", "desc")
  .limit(1)

const getUnnotifiedSubscriptions = async (patchNumber: number) =>
  db
    .selectFrom("subscriptions")
    .selectAll()
    .where("environment", "=", process.env.NODE_ENV)
    .where("lastNotified", "<", patchNumber)
    .orderBy("createdAt")
    .limit(1000)
    .execute()

const getUnnotifiedSubscriptionsCount = async (patchNumber: number) =>
  db
    .selectFrom("subscriptions")
    .select(({ fn }) => [fn.count<number>("endpoint").as("cnt")])
    .where("environment", "=", process.env.NODE_ENV)
    .where("lastNotified", "<", patchNumber)
    .execute()

export const queries = {
  getLatestPatch: async () => {
    log.debug("db", "Getting latest patch...")

    const rows = await getLatestPatchQuery.execute().catch((error) => error as Error)

    if (rows instanceof Error) {
      throw new TypeError("Failed to get latest patch.", { cause: rows })
    }

    if (rows.length === 0) {
      throw new Error("No patches found.")
    }

    const patch = rows[0]!
    log.debug({ tag: "db", message: "Got latest patch.", patch: patch.id })
    return patch
  },

  updateNotifiedSubscriptions: async (endpoints: string[], patch: Patch) => {
    log.debug({
      tag: "db",
      message: "Updating notified subscriptions...",
      patch: patch.id,
      endpoints: endpoints.length,
    })

    const result = await db
      .updateTable("subscriptions")
      .set("lastNotified", patch.number)
      .where("endpoint", "in", endpoints)
      .returning(["endpoint", "lastNotified"])
      .execute()

    log.debug({
      tag: "db",
      message: "Updated notified subscriptions...",
      count: result.length,
    })

    return result
  },

  deleteSubscriptions: async (endpoints: string[]) => {
    log.debug({ tag: "db", message: "Deleting subscriptions...", endpoints })

    const result = await db
      .deleteFrom("subscriptions")
      .where("endpoint", "in", endpoints)
      .returning(["lastNotified"])
      .execute()

    return result.length
  },

  getUnnotifiedSubscriptions: async (patch: Patch) => {
    log.debug({
      tag: "db",
      message: "Getting unnotified subscriptions...",
      patch: patch.id,
    })

    const rows = await getUnnotifiedSubscriptions(patch.number).catch(
      (error) => error as Error,
    )

    const countResults = await getUnnotifiedSubscriptionsCount(patch.number).catch(
      (error) => error as Error,
    )

    if (rows instanceof Error || countResults instanceof Error) {
      const error = (rows instanceof Error ? rows : countResults) as Error
      log.error({ tag: "db", message: "Failed to get unnotified subscriptions.", error })

      return {
        data: null,
        count: null,
        error,
      }
    }

    log.debug({
      tag: "db",
      message: "Got unnotified subscriptions.",
      count: countResults[0]!.cnt,
    })
    return {
      data: rows,
      count: Number(countResults[0]!.cnt),
      error: null,
    }
  },
}
