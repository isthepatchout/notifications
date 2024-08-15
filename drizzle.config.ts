import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: "localhost",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "postgres",
  },
})
