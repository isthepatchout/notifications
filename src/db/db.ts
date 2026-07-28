import fs from "node:fs"
import { DatabaseSync } from "node:sqlite"

import { log } from "evlog"

import { migrate } from "./migrate.ts"
import type { Patch, PushSubscription } from "./schema.ts"

fs.mkdirSync(".data", { recursive: true })
export const db = new DatabaseSync(".data/db.sqlite")

if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
  migrate(db)
}

log.info("db", "Connected to .data/db.sqlite")

type PatchRow = Omit<Patch, "links"> & { links: Buffer | string | null }

const toPatch = (row: PatchRow): Patch => ({
  ...row,
  links: JSON.parse(row.links?.toString() ?? "[]") as string[],
})

const getLatestPatch = db.prepare(`
  SELECT * FROM patches ORDER BY number DESC LIMIT 1
`)
const getUnnotifiedSubscriptions = db.prepare(`
  SELECT * FROM subscriptions
  WHERE environment = ? AND "lastNotified" < ?
  ORDER BY "createdAt"
  LIMIT 500
`)
const getUnnotifiedSubscriptionsCount = db.prepare(`
  SELECT COUNT(endpoint) AS count FROM subscriptions
  WHERE environment = ? AND "lastNotified" < ?
`)

const endpointsPlaceholders = (endpoints: string[]) => endpoints.map(() => "?").join(", ")

export const queries = {
  getLatestPatch: async (): Promise<Patch> => {
    log.debug("db", "Getting latest patch...")

    try {
      const row = getLatestPatch.get() as PatchRow | undefined
      if (row == null) throw new Error("No patches found.")

      const patch = toPatch(row)
      log.debug({ tag: "db", message: "Got latest patch.", patch: patch.id })
      return patch
    } catch (error) {
      if (error instanceof Error && error.message === "No patches found.") throw error
      throw new TypeError("Failed to get latest patch.", { cause: error })
    }
  },

  updateNotifiedSubscriptions: async (endpoints: string[], patch: Patch) => {
    if (endpoints.length === 0) {
      return [] as Array<Pick<PushSubscription, "endpoint" | "lastNotified">>
    }

    log.debug({
      tag: "db",
      message: "Updating notified subscriptions...",
      patch: patch.id,
      endpoints: endpoints.length,
    })

    const result = db
      .prepare(`
        UPDATE subscriptions SET "lastNotified" = ?
        WHERE endpoint IN (${endpointsPlaceholders(endpoints)})
        RETURNING endpoint, "lastNotified"
      `)
      .all(patch.number, ...endpoints) as Array<Pick<PushSubscription, "endpoint" | "lastNotified">>

    log.debug({ tag: "db", message: "Updated notified subscriptions...", count: result.length })
    return result
  },

  deleteSubscriptions: async (endpoints: string[]) => {
    if (endpoints.length === 0) return 0

    log.debug({ tag: "db", message: "Deleting subscriptions...", endpoints })

    const result = db
      .prepare(`
        DELETE FROM subscriptions WHERE endpoint IN (${endpointsPlaceholders(endpoints)})
        RETURNING "lastNotified"
      `)
      .all(...endpoints)

    return result.length
  },

  getUnnotifiedSubscriptions: async (patch: Patch) => {
    log.debug({ tag: "db", message: "Getting unnotified subscriptions...", patch: patch.id })

    try {
      const data = getUnnotifiedSubscriptions.all(
        process.env.NODE_ENV,
        patch.number,
      ) as PushSubscription[]
      const count = (
        getUnnotifiedSubscriptionsCount.get(process.env.NODE_ENV, patch.number) as {
          count: number
        }
      ).count

      log.debug({ tag: "db", message: "Got unnotified subscriptions.", count })
      return { data, count, error: null }
    } catch (error) {
      log.error({
        tag: "db",
        message: "Failed to get unnotified subscriptions.",
        error,
      })
      return { data: null, count: null, error: error as Error }
    }
  },
}
