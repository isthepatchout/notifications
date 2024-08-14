import { Buffer } from "node:buffer"
import { randomBytes } from "node:crypto"
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "bun:test"
import { DotaVersion } from "dotaver"
import { HttpResponse, http } from "msw"
import { setupServer } from "msw/node"
import { $subscriptions, type Patch, type PushSubscription } from "./db/schema.ts"
import { db, pg } from "./db/db.ts"
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

const handlers = [
  http.post("https://notif.example.com/:type/success/:id", () => HttpResponse.text("Ok")),
  http.post("https://notif.example.com/discord/error/:id", () =>
    HttpResponse.text("Error", { status: 404 }),
  ),
  http.post("https://notif.example.com/push/error/:id", () =>
    HttpResponse.text("Error", { status: 410 }),
  ),
]

const server = setupServer(...handlers)

beforeAll(() => server.listen())
beforeEach(async () => {
  await db.delete($subscriptions)
  index = 0
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(async () => {
  server.close()
  await pg.end()
})

const p256dh = await generateP256dh()
const patch = {
  id: "8.00",
  number: DotaVersion.parse("8.00").toNumber(),
  releasedAt: new Date(),
  links: [],
} satisfies Patch

const getSubs = async () => db.select().from($subscriptions)

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

  await db.insert($subscriptions).values(subscriptions).execute()
}

it("should send notifications", async () => {
  await generateSubs(5)

  await sendNotifications(await getSubs(), patch)

  const results = await getSubs()
  expect(results.map((sub) => sub.lastNotified)).toMatchObject([
    patch.number,
    patch.number,
    patch.number,
    patch.number,
    patch.number,
  ])
})

it("should remove expired discord webhooks", async () => {
  await generateSubs(2)
  await generateSubs(2, "discord", true)

  await sendNotifications(await getSubs(), patch)

  const results = await getSubs()
  expect(results).toHaveLength(2)
  expect(results[0]!.endpoint.at(-1)).toBe("0")
  expect(results[1]!.endpoint.at(-1)).toBe("1")
})

it("should remove expired push webhooks", async () => {
  await generateSubs(2, "push")
  await generateSubs(2, "push", true)

  await sendNotifications(await getSubs(), patch)

  const results = await getSubs()
  expect(results).toHaveLength(2)
  expect(results[0]!.endpoint.at(-1)).toBe("0")
  expect(results[1]!.endpoint.at(-1)).toBe("1")
})
