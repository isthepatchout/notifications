import { Buffer } from "node:buffer"
import { randomBytes } from "node:crypto"

import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "bun:test"
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

const mockServer = new MockServer("https://notif.example.com")

const mockOkResponse = (type: PushSubscription["type"], times: number) => {
  for (let i = 0; i < times; i++) {
    mockServer.post({ url: "/:type/success/:id", params: { type } }, 200)
  }
}
const mockErrorResponse = (type: PushSubscription["type"], times: number) => {
  for (let i = 0; i < times; i++) {
    mockServer.post(
      { url: "/:type/error/:id", params: { type } },
      type === "discord" ? 404 : 410,
    )
  }
}

const mocker = new FetchMocker({ servers: [mockServer] })

beforeAll(() => mocker.mockGlobal())
beforeEach(async () => {
  await db.deleteFrom("subscriptions").execute()
  index = 0
})
afterEach(async () => {
  mocker.clearAll()
})
afterAll(async () => {
  await db.deleteFrom("subscriptions").execute()
  mocker.unmockGlobal()
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
  mockOkResponse("discord", 5)
  await generateSubs(5)

  await sendNotifications(await getSubs(), patch)

  const results = await getSubs()
  expect(results.map((sub) => sub.lastNotified)).toStrictEqual([
    patch.number,
    patch.number,
    patch.number,
    patch.number,
    patch.number,
  ])
})

it("should remove expired discord webhooks", async () => {
  mockOkResponse("discord", 2)
  mockErrorResponse("discord", 2)
  await generateSubs(2)
  await generateSubs(2, "discord", true)

  await sendNotifications(await getSubs(), patch)

  const results = await getSubs()
  expect(results).toHaveLength(2)
  expect(results[0]!.endpoint.at(-1)).toBe("0")
  expect(results[1]!.endpoint.at(-1)).toBe("1")
})

it("should remove expired push webhooks", async () => {
  mockOkResponse("push", 2)
  mockErrorResponse("push", 2)
  await generateSubs(2, "push")
  await generateSubs(2, "push", true)

  await sendNotifications(await getSubs(), patch)

  const results = await getSubs()
  expect(results).toHaveLength(2)
  expect(results[0]!.endpoint.at(-1)).toBe("0")
  expect(results[1]!.endpoint.at(-1)).toBe("1")
})
