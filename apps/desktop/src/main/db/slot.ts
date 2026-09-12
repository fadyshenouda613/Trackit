import type { Database } from './index'

/*
 * A database handle whose connection can be swapped.
 *
 * Every service in main takes a `db` once, at wiring, and keeps it. Switching
 * accounts means the file underneath changes while those services stay up,
 * so they are handed this: a `Database` that forwards each call to whichever
 * connection the slot holds now. Nothing prepared is cached across calls
 * anywhere in main (each repository call prepares its own statement), so a
 * swap between two calls is invisible to the caller.
 *
 * The swap itself is the wiring's job: wait for whatever is mid-flight,
 * close the old connection, open the new one, replace.
 */

export type DatabaseSlot = {
  /** The forwarding handle. Hand this out; keep the real connections here. */
  db: Database
  /** The connection the handle forwards to right now. */
  current: () => Database
  /** Points the handle at another connection and returns the one it replaced, still open. */
  replace: (next: Database) => Database
}

export function createDatabaseSlot(initial: Database): DatabaseSlot {
  let held = initial
  const db = new Proxy(initial, {
    get: (_target, property) => {
      const value = Reflect.get(held, property, held)
      return typeof value === 'function' ? value.bind(held) : value
    },
    set: (_target, property, value) => Reflect.set(held, property, value, held)
  })
  return {
    db,
    current: () => held,
    replace: (next) => {
      const previous = held
      held = next
      return previous
    }
  }
}
