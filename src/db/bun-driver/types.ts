import { SQL } from "bun"

export type BunDialectConfig = {
  // Required
  url: string

  // Optional configuration
  hostname?: string
  port?: number
  database?: string
  username?: string
  password?: string

  // Connection pool settings
  max?: number // Maximum connections in pool
  idleTimeout?: number // Close idle connections after 30s
  maxLifetime?: number // Connection lifetime in seconds (0 = forever)
  connectionTimeout?: number // Timeout when establishing new connections

  // SSL/TLS options
  tls?: boolean
  // tls: {
  //   rejectUnauthorized: true,
  //   requestCert: true,
  //   ca: "path/to/ca.pem",
  //   key: "path/to/key.pem",
  //   cert: "path/to/cert.pem",
  //   checkServerIdentity(hostname, cert) {
  //     ...
  //   },
  // },

  // Callbacks
  onconnect?: (client: SQL) => void
  onclose?: (client: SQL) => void
}
