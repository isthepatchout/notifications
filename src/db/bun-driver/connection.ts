import type { SQL } from "bun"
import {
  CompiledQuery,
  type DatabaseConnection,
  type QueryResult,
  type TransactionSettings,
} from "kysely"

import { BunDialectError } from "./errors.js"

type SqlResult<R> = R[] & {
  count?: number
  command?: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | string
}

export class BunConnection implements DatabaseConnection {
  #reservedConnection: SQL

  constructor(reservedConnection: SQL) {
    this.#reservedConnection = reservedConnection
  }

  async beginTransaction(settings: TransactionSettings): Promise<void> {
    const { isolationLevel } = settings

    const compiledQuery = CompiledQuery.raw(
      isolationLevel ? `start transaction isolation level ${isolationLevel}` : "begin",
    )

    await this.executeQuery(compiledQuery)
  }

  async commitTransaction(): Promise<void> {
    await this.executeQuery(CompiledQuery.raw("commit"))
  }

  #countCommands = new Set(["INSERT", "UPDATE", "DELETE"])

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const sqlQuery = this.#reservedConnection
      .unsafe(compiledQuery.sql, compiledQuery.parameters.slice())
      .execute()

    const rows = (await sqlQuery) as SqlResult<R>

    if (this.#countCommands.has(rows.command!)) {
      const numAffectedRows = BigInt(rows.count ?? rows.length)

      return { numAffectedRows, rows: Array.from(rows) }
    }

    return { rows: Array.from(rows) }
  }

  async releaseConnection(): Promise<void> {
    await this.#reservedConnection.close()

    this.#reservedConnection = null!
  }

  async rollbackTransaction(): Promise<void> {
    await this.executeQuery(CompiledQuery.raw("rollback"))
  }

  async *streamQuery<R>(): AsyncGenerator<QueryResult<R>> {
    throw new BunDialectError("streamQuery is not supported")
  }
}
