import { Kysely } from "kysely"
import { PostgresJSDialect } from "kysely-postgres-js"
import postgres from "postgres"

import { Logger } from "../logger.ts"

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

  Logger.info(`Connected to db @ ${new URL(process.env.DATABASE_URL!).host}`)
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
    Logger.debug("Getting latest patch...")

    const rows = await getLatestPatchQuery.execute().catch((error) => error as Error)

    if (rows instanceof Error) {
      throw new TypeError("Failed to get latest patch.", { cause: rows })
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
      .updateTable("subscriptions")
      .set("lastNotified", patch.number)
      .where("endpoint", "in", endpoints)
      .returning(["endpoint", "lastNotified"])
      .execute()

    Logger.debug({ count: result.length }, "Updated notified subscriptions...")

    return result
  },

  deleteSubscriptions: async (endpoints: string[]) => {
    Logger.debug({ endpoints }, "Deleting subscriptions...")

    const result = await db
      .deleteFrom("subscriptions")
      .where("endpoint", "in", endpoints)
      .returning(["lastNotified"])
      .execute()

    return result.length
  },

  getUnnotifiedSubscriptions: async (patch: Patch) => {
    Logger.debug({ patch: patch.id }, "Getting unnotified subscriptions...")

    const rows = await getUnnotifiedSubscriptions(patch.number).catch(
      (error) => error as Error,
    )

    const countResults = await getUnnotifiedSubscriptionsCount(patch.number).catch(
      (error) => error as Error,
    )

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
      count: Number(countResults[0]!.cnt),
      error: null,
    }
  },
}
