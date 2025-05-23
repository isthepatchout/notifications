schema "public" {}

table "patches" {
  schema = schema.public

  primary_key {
    columns = [column.id]
  }

  index "idx_releasedAt" {
    columns = [column.releasedAt]
  }
  index "idx_number" {
    columns = [column.number]
  }

  column "id" {
    type = text
    null = false
  }
  column "number" {
    type = integer
    null = false
  }
  column "links" {
    type = sql("text[]")
    null = false
  }
  column "releasedAt" {
    type = timestamp
  }
}

enum "sub_type" {
  schema = schema.public
  values = ["push", "discord"]
}

table "subscriptions" {
  schema = schema.public

  primary_key {
    columns = [column.endpoint]
  }

  index "subscriptions_list_order_idx" {
    columns = [column.createdAt]
  }
  index "subscriptions_list_idx" {
    columns = [column.environment, column.lastNotified]
  }

  column "type" {
    type = enum.sub_type
    null = false
  }
  column "endpoint" {
    type = text
    null = false
  }
  column "auth" {
    type = text
    null = false
  }
  column "extra" {
    type = text
    null = true
  }
  column "environment" {
    type = text
    null = false
  }
  column "lastNotified" {
    type = integer
    null = false
  }
  column "createdAt" {
    type    = timestamp
    default = sql("now()")
  }
}
