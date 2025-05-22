import { DotaVersion } from "dotaver"

import { db, getLatestPatchQuery } from "../db/db.ts"
import type { Patch } from "../db/schema.ts"

const latestPatch = await getLatestPatchQuery.execute().then((patches) => patches[0]!)

const patch = DotaVersion.parse(latestPatch.id).increment(0, 1, 0)

const toInsert = {
  id: patch.toString(),
  number: patch.toNumber(),
  releasedAt: new Date(),
  links: [],
} satisfies Patch

await db.insertInto("patches").values(toInsert).execute()
