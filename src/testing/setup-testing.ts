import { Buffer } from "node:buffer"
import { randomBytes } from "node:crypto"

import { db } from "../db/db.ts"
import type { PushSubscription } from "../db/schema.ts"

if (!process.env.DATABASE_URL?.includes("localhost")) {
  throw new Error("This script can only be run in a local environment")
}

const generateP256dh = async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // extractable
    ["deriveBits"],
  )

  const publicKey = await crypto.subtle.exportKey(
    "raw", // export the raw key material
    keyPair.publicKey,
  )

  return Buffer.from(publicKey).toString("base64url")
}

let index = 0
const generateSubs = async (
  count: number,
  type: PushSubscription["type"] = "discord",
  error = false,
) => {
  const p256dh = await generateP256dh()

  return Array.from(
    { length: count },
    () =>
      ({
        endpoint: `https://localhost:3000/${type}/${!error ? "success" : "error"}/${index++}`,
        auth:
          type === "push"
            ? randomBytes(16).toString("base64")
            : Math.round(Math.random() * 100000).toString(),
        extra: type === "push" ? p256dh : Math.round(Math.random() * 1000000).toString(),
        type,
        environment: "test",
        lastNotified: 80000,
      }) satisfies Omit<PushSubscription, "createdAt">,
  )
}

await Promise.all([db.deleteFrom("patches"), db.deleteFrom("subscriptions")])

const subs = [
  await generateSubs(100, "discord"),
  await generateSubs(100, "discord", true),
  await generateSubs(100, "push"),
  await generateSubs(100, "push", true),
].flat()

await db.insertInto("subscriptions").values(subs).execute()

await db
  .insertInto("patches")
  .values({
    id: "8.00",
    number: 80000,
    releasedAt: new Date(),
    links: [],
  })
  .execute()
