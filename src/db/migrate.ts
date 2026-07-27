import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { log } from "evlog"
import postgres, { type Sql } from "postgres"

const migrationsDirectory = join(import.meta.dirname, "migrations")

export async function migrate(db: Sql) {
  log.info("migrations", "Starting DB migrations...")

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .toSorted()
  const migrations = await Promise.all(
    files.map(async (name) => ({
      name,
      sql: await readFile(join(migrationsDirectory, name), "utf8"),
    })),
  )
  const rows = await db<{ name: string }[]>`SELECT name FROM migrations`
  const applied = new Set(rows.map((row) => row.name))

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue

    log.info("migrations", `Applying ${migration.name}...`)

    try {
      // Migrations must be committed in filename order.
      // oxlint-disable-next-line no-await-in-loop
      await db.begin(async (transaction) => {
        await transaction.unsafe(migration.sql)
        await transaction`INSERT INTO migrations (name) VALUES (${migration.name})`
      })

      log.info("migrations", `Applied ${migration.name}`)
    } catch (error) {
      log.error("migrations", `Migration ${migration.name} failed: ${(error as Error).message}`)
      throw new Error(`Migration failed: ${migration.name}`, { cause: error })
    }
  }

  log.info("migrations", "Migrations are up to date.")
}

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) throw new Error("DATABASE_URL is required to run migrations")

const db = postgres(databaseUrl, { max: 1 })

try {
  await migrate(db)
} finally {
  await db.end()
}
