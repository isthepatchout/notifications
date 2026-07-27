import { DotaVersion } from "dotaver"

import { db, queries } from "../db/db.ts"
import type { Patch } from "../db/schema.ts"

const latestPatch = await queries.getLatestPatch()

const patch = DotaVersion.parse(latestPatch.id).increment(0, 1, 0)

const toInsert = {
  id: patch.toString(),
  number: patch.toNumber(),
  releasedAt: new Date().toISOString(),
  links: [],
} satisfies Patch

db.prepare(`
  INSERT INTO patches (id, number, "releasedAt", links) VALUES (?, ?, ?, ?)
`).run(toInsert.id, toInsert.number, toInsert.releasedAt, JSON.stringify(toInsert.links))
