// oxlint-disable typescript/no-floating-promises
import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import { randomBytes } from "node:crypto"
import { after, afterEach, before, beforeEach, it } from "node:test"

import { DotaVersion } from "dotaver"
import { FetchMocker, MockServer } from "mentoss"

import { db } from "./db/db.ts"
import type { Patch, PushSubscription } from "./db/schema.ts"
import { sendNotifications } from "./notifications.ts"

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

const server = new MockServer("https://notif.example.com")
const fetchMocker = new FetchMocker({ servers: [server] })

const mockSuccessRequest = (type: PushSubscription["type"], id: number) => {
  server.post(
    {
      url: "/:type/success/:id",
      params: { type, id: id.toString() },
    },
    { status: 200, body: "Ok" },
  )
}
const mockErrorRequest = (type: PushSubscription["type"], id: number) => {
  server.post(
    {
      url: "/:type/error/:id",
      params: { type, id: id.toString() },
    },
    { status: type === "discord" ? 404 : 410, body: "Error" },
  )
}

before(() => fetchMocker.mockGlobal())
beforeEach(async () => {
  db.exec("DELETE FROM subscriptions")
  index = 0
})
afterEach(async () => {
  fetchMocker.clearAll()
})
after(async () => {
  db.exec("DELETE FROM subscriptions")
  fetchMocker.unmockGlobal()
  db.close()
})

const p256dh = await generateP256dh()
const patch = {
  id: "8.00",
  number: DotaVersion.parse("8.00").toNumber(),
  releasedAt: new Date().toISOString(),
  links: [],
} satisfies Patch

const getSubs = () =>
  db.prepare("SELECT * FROM subscriptions ORDER BY endpoint").all() as PushSubscription[]

let index = 0
const generateSubs = async (
  count: number,
  type: PushSubscription["type"] = "discord",
  error = false,
) => {
  const subscriptions = Array.from(
    { length: count },
    () =>
      ({
        endpoint: `https://notif.example.com/${type}/${!error ? "success" : "error"}/${index++}`,
        auth: randomBytes(16).toString("base64"),
        extra: p256dh,
        type,
        environment: "test",
        lastNotified: -1,
      }) satisfies Omit<PushSubscription, "createdAt">,
  )

  const insert = db.prepare(`
    INSERT INTO subscriptions (type, endpoint, auth, extra, environment, "lastNotified")
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const subscription of subscriptions) {
    insert.run(
      subscription.type,
      subscription.endpoint,
      subscription.auth,
      subscription.extra,
      subscription.environment,
      subscription.lastNotified,
    )
  }
}

it("should send notifications", async () => {
  await generateSubs(5)
  const subs = getSubs()
  subs.forEach((sub, index) => mockSuccessRequest(sub.type, index))

  await sendNotifications(subs, patch)

  const results = getSubs()
  assert.deepEqual(
    results.map((sub) => sub.lastNotified),
    [patch.number, patch.number, patch.number, patch.number, patch.number],
  )
})

it("should remove expired discord webhooks", async () => {
  await generateSubs(2)
  await generateSubs(2, "discord", true)

  mockSuccessRequest("discord", 0)
  mockSuccessRequest("discord", 1)
  mockErrorRequest("discord", 2)
  mockErrorRequest("discord", 3)

  await sendNotifications(getSubs(), patch)

  const results = getSubs()
  assert.equal(results.length, 2)
  assert.equal(results[0]!.endpoint.at(-1), "0")
  assert.equal(results[1]!.endpoint.at(-1), "1")
})

it("should remove expired push webhooks", async () => {
  await generateSubs(2, "push")
  await generateSubs(2, "push", true)

  mockSuccessRequest("push", 0)
  mockSuccessRequest("push", 1)
  mockErrorRequest("push", 2)
  mockErrorRequest("push", 3)

  await sendNotifications(getSubs(), patch)

  const results = getSubs()
  assert.equal(results.length, 2)
  assert.equal(results[0]!.endpoint.at(-1), "0")
  assert.equal(results[1]!.endpoint.at(-1), "1")
})
