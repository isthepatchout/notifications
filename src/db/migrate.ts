import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { DatabaseSync } from "node:sqlite"
import { fileURLToPath } from "node:url"

import { log } from "evlog"

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "migrations")

export function migrate(db: DatabaseSync) {
  log.info("migrations", "Starting DB migrations...")

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA wal_autocheckpoint = 1000;
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  const migrations = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .toSorted()
    .map((name) => ({ name, sql: readFileSync(join(migrationsDirectory, name), "utf8") }))
  const rows = db.prepare("SELECT name FROM migrations").all() as Array<{ name: string }>
  const applied = new Set(rows.map((row) => row.name))
  const recordMigration = db.prepare("INSERT INTO migrations (name) VALUES (?)")

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue

    log.info("migrations", `Applying ${migration.name}...`)

    try {
      db.exec("BEGIN IMMEDIATE")
      db.exec(migration.sql)
      recordMigration.run(migration.name)
      db.exec("COMMIT")
      log.info("migrations", `Applied ${migration.name}`)
    } catch (error) {
      try {
        db.exec("ROLLBACK")
      } catch {}
      log.error("migrations", `Migration ${migration.name} failed: ${(error as Error).message}`)
      throw new Error(`Migration failed: ${migration.name}`, { cause: error })
    }
  }

  log.info("migrations", "Migrations are up to date.")
}
