export class BunDialectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BunDialectError"
  }
}
