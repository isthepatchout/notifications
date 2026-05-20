import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import { randomBytes } from "node:crypto"
import { after, afterEach, before, beforeEach, it } from "node:test"

import { DotaVersion } from "dotaver"
import { FetchMocker, MockServer } from "mentoss"

import { db, pg } from "./db/db.ts"
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
  await db.deleteFrom("subscriptions").execute()
  index = 0
})
afterEach(async () => {
  fetchMocker.clearAll()
})
after(async () => {
  await db.deleteFrom("subscriptions").execute()
  fetchMocker.unmockGlobal()
  await pg.end()
})

const p256dh = await generateP256dh()
const patch = {
  id: "8.00",
  number: DotaVersion.parse("8.00").toNumber(),
  releasedAt: new Date(),
  links: [],
} satisfies Patch

const getSubs = async () => db.selectFrom("subscriptions").selectAll().execute()

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

  await db.insertInto("subscriptions").values(subscriptions).execute()
}

it("should send notifications", async () => {
  await generateSubs(5)
  const subs = await getSubs()
  subs.forEach((sub, index) => mockSuccessRequest(sub.type, index))

  await sendNotifications(subs, patch)

  const results = await getSubs()
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

  await sendNotifications(await getSubs(), patch)

  const results = await getSubs()
  assert.equal(results.length, 2)
  assert.equal(results[0]!.endpoint.at(-1), "0")
  assert.equal(results[1]!.endpoint.at(-1), "1")
})

void it.skip("should remove expired push webhooks", async () => {
  await generateSubs(2, "push")
  await generateSubs(2, "push", true)

  mockSuccessRequest("push", 0)
  mockSuccessRequest("push", 1)
  mockErrorRequest("push", 2)
  mockErrorRequest("push", 3)

  await sendNotifications(await getSubs(), patch)

  const results = await getSubs()
  assert.equal(results.length, 2)
  assert.equal(results[0]!.endpoint.at(-1), "0")
  assert.equal(results[1]!.endpoint.at(-1), "1")
})
