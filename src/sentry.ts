import { init, Integrations, setTag } from "@sentry/node"

init({
  enabled: process.env.NODE_ENV !== "development" && !!process.env.SENTRY_DSN,
  release: process.env.RENDER_GIT_COMMIT,
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [new Integrations.Http({ tracing: true })],
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 1),
})

setTag("app", "notifications")
