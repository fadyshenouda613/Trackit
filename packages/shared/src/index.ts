/*
 * What the desktop app and the server agree on.
 *
 * Two doors. `./api` is the contract the preload bridge exposes to the
 * renderer — desktop-only in practice, but it lives here because the shape of
 * what crosses the bridge is a shared concern. `./schemas` is where every
 * entity is defined, once, as a Zod schema; every type in every package is
 * inferred from there and never redeclared.
 *
 * Both are also reachable as `@trackit/shared/api` and `@trackit/shared/schemas`
 * so a file can say which one it wants.
 */
export type { LedgerApi } from './api'
export * from './schemas'
