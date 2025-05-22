import {
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryCompiler,
} from "kysely"

import { BunDriver } from "./driver"
import type { BunDialectConfig } from "./types"
import { freeze } from "./utils"

export class BunDialect implements Dialect {
  readonly #config: BunDialectConfig

  constructor(config: BunDialectConfig) {
    this.#config = freeze({ ...config })
  }

  createAdapter(): DialectAdapter {
    return new PostgresAdapter()
  }

  createDriver(): Driver {
    return new BunDriver(this.#config)
  }

  createIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
    return new PostgresIntrospector(db)
  }

  createQueryCompiler(): QueryCompiler {
    return new PostgresQueryCompiler()
  }
}
