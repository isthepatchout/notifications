import { Buffer } from "node:buffer"
import { randomBytes } from "node:crypto"

import { db } from "../db/db.ts"
import type { PushSubscription } from "../db/schema.ts"

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

db.exec("DELETE FROM patches; DELETE FROM subscriptions;")

const subs = [
  await generateSubs(100, "discord"),
  await generateSubs(100, "discord", true),
  await generateSubs(100, "push"),
  await generateSubs(100, "push", true),
].flat()

const insertSubscription = db.prepare(`
  INSERT INTO subscriptions (type, endpoint, auth, extra, environment, "lastNotified")
  VALUES (?, ?, ?, ?, ?, ?)
`)
for (const subscription of subs) {
  insertSubscription.run(
    subscription.type,
    subscription.endpoint,
    subscription.auth,
    subscription.extra,
    subscription.environment,
    subscription.lastNotified,
  )
}

db.prepare(`
  INSERT INTO patches (id, number, "releasedAt", links) VALUES (?, ?, ?, ?)
`).run("8.00", 80000, new Date().toISOString(), JSON.stringify([]))
