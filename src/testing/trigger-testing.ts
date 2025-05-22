import { DotaVersion } from "dotaver"
import { desc } from "drizzle-orm/sql"

import { db, pg } from "../db/db.ts"
import { $patches } from "../db/schema.ts"

const latestPatch = await db
  .select({ id: $patches.id })
  .from($patches)
  .orderBy(desc($patches.number))
  .limit(1)

const patch = DotaVersion.parse(latestPatch[0]!.id).increment(0, 1, 0)

await db.insert($patches).values([
  {
    id: patch.toString(),
    number: patch.toNumber(),
    releasedAt: new Date(),
    links: [],
  },
])

await pg.end()
