export type Patch = {
  id: string
  number: number
  links: string[]
  releasedAt: string | null
}

export type PushSubscription = {
  type: "push" | "discord"
  endpoint: string
  auth: string
  extra: string | null
  environment: string
  lastNotified: number
  createdAt: string
}
