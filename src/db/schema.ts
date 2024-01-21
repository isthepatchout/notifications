import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const $patches = pgTable(
  "patches",
  {
    id: text("id").primaryKey().notNull(),
    number: integer("number").notNull(),
    links: text("links").array().notNull(),
    releasedAt: timestamp("releasedAt"),
  },
  (table) => ({
    idxNumber: index("idx_number").on(table.number),
    idxReleasedAt: index("idx_releasedAt").on(table.releasedAt),
  }),
)

export type Patch = typeof $patches.$inferSelect
export type PatchInsert = typeof $patches.$inferSelect

export const $subscriptions = pgTable("subscriptions", {
  endpoint: text("endpoint").primaryKey().notNull(),
  type: text("type", { enum: ["push", "discord"] })
    .notNull()
    .default("push"),
  auth: text("auth").notNull(),
  extra: text("extra"),
  environment: text("environment").notNull(),
  lastNotified: integer("lastNotified").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
})

export type PushSubscription = typeof $subscriptions.$inferSelect
export type PushSubscriptionInsert = typeof $subscriptions.$inferSelect
