/* eslint-disable @typescript-eslint/naming-convention */
import type { Database } from "./types.generated"

export type { Database }

export type Patch = Database["public"]["Tables"]["patches"]["Row"]
export type PushSubscription = Database["public"]["Tables"]["subscriptions"]["Row"]
export type PushEventPatch = Patch & {
  type: "patch"
}

export type RealtimeChange<Table extends keyof Database["public"]["Tables"]> = {
  eventType: "INSERT" | "UPDATE" | "DELETE"
  table: Table
  record?: Database["public"]["Tables"][Table]["Row"]
  old_record?: Database["public"]["Tables"][Table]["Row"]
  commit_timestamp: string
  schema: keyof Database
  columns: Array<{ name: string; type: string }>
  errors: unknown[] | null
}
