-- Create enum type "sub_type"
CREATE TYPE "public"."sub_type" AS ENUM ('push', 'discord');
-- Create "patches" table
CREATE TABLE "public"."patches" ("id" text NOT NULL, "number" integer NOT NULL, "links" text[] NOT NULL, "releasedAt" timestamp NOT NULL, PRIMARY KEY ("id"));
-- Create index "idx_number" to table: "patches"
CREATE INDEX "idx_number" ON "public"."patches" ("number");
-- Create index "idx_releasedAt" to table: "patches"
CREATE INDEX "idx_releasedAt" ON "public"."patches" ("releasedAt");
-- Create "subscriptions" table
CREATE TABLE "public"."subscriptions" ("type" "public"."sub_type" NOT NULL, "endpoint" text NOT NULL, "auth" text NOT NULL, "extra" text NULL, "environment" text NOT NULL, "lastNotified" integer NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now(), PRIMARY KEY ("endpoint"));
-- Create index "subscriptions_list_idx" to table: "subscriptions"
CREATE INDEX "subscriptions_list_idx" ON "public"."subscriptions" ("environment", "lastNotified");
-- Create index "subscriptions_list_order_idx" to table: "subscriptions"
CREATE INDEX "subscriptions_list_order_idx" ON "public"."subscriptions" ("createdAt");
