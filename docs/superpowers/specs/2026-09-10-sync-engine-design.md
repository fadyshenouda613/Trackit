# Sync engine — design

Date: 2026-09-10. Branch: `feat/sync-engine`, off `feat/server-auth`.

## What this is

The piece the repository has been shaped around. Every syncable row already
carries `updatedAt`, `deletedAt` and a `syncState`; the server already has a
mirror of every table with `user_id` and `server_seq`; the sidebar footer, the
pending-changes popover and the two conflict notices already exist as fixtures.
This work connects them: a `POST /sync` endpoint, a sync module in the main
process, and the wiring that makes the footer's four states, the popover's
counts and the notices report what actually happened.

The rules the rest of the repository already holds — money as cents, UTC
timestamps, client-minted ids, soft deletes, logic in plain functions over a
`db` handle, a thin typed bridge — are what make this possible, and nothing
here bends them.

## Protocol

One endpoint. Every sync is one or more round trips of the same call.

```
POST /sync
Authorization: Bearer <access token>

{
  protocolVersion: 1,
  deviceId: "<uuid, minted once per install>",
  since: <cursor from the last response, 0 on a fresh machine>,
  changes: { clients: Row[], projects: Row[], ... }     // this machine's pending rows
}

200 {
  cursor: <serverSeq of the last row in this page>,
  hasMore: <true when another page remains>,
  changes: { clients: Row[], projects: Row[], ... },   // rows to apply, parent tables first
  rejected: [{ table, id, reason: 'missing_parent' | 'forbidden' }]
}
```

A wire row is the entity minus `syncState` (that is a fact about the client's
copy). Rows the server sends back additionally carry `updatedBy`: the device
that wrote the version being sent, or `null` for rows written before this
column existed. Settings travel as one row with no `id`, minus `theme` and
`accountEmail`, which are the machine's and not the account's.

All of it is defined once in `packages/shared/src/schemas/sync.ts`: the table
name enum, one push-row and one pull-row schema per table derived from the
entity schemas, `syncRequestSchema`, `syncResponseSchema`, and the status and
conflict shapes the bridge hands the renderer.

### Why `rejected` exists

The spec called for `{ cursor, changes, hasMore }`. Two things a client must
know cannot be inferred from that:

- A row whose parent the server does not have (a project for a client that
  was never uploaded, or one belonging to another account) cannot be stored.
  The client has to keep it pending and try again later, so the server names
  it. Nothing else is ever rejected: a row that loses on `updatedAt` is not
  rejected, it is *superseded*, and the winner comes back in `changes`.
- A row of another account's, or one that fails validation, is `forbidden`.
  The client drops it from its retry loop by marking it synced; it will never
  be accepted and re-sending it forever helps nobody.

### Protocol version

The body carries `protocolVersion: 1`. A server that no longer accepts that
version answers `426` with code `upgrade_required`, which the footer shows as
"This version is too old to sync" — the one failure reason in the existing UI
that had nothing to trigger it.

## Server

### One sequence, not ten

`server_seq` was a `BIGSERIAL` per table, which is ten independent sequences.
A single `since` cursor across ten sequences cannot be correct — a client
would have to remember ten. Migration `0001_sync` creates one sequence,
`sync_seq`, and points every table's `server_seq` default at it, dropping the
per-table sequences. Every server write — insert or update — sets
`server_seq = nextval('sync_seq')` explicitly, so a row always sits at the
position of its latest write and never at an older one.

The same migration adds `updated_by uuid` (nullable) to every syncable table,
for the tie-break below.

### Ordering under concurrency

Two syncs for the same account at once could otherwise interleave so that a
row committed with a lower `server_seq` than one a client has already seen
is never delivered. The whole sync runs in one transaction that first takes
`pg_advisory_xact_lock(hashtext(userId))`, so an account's syncs are serial:
sequence numbers are handed out and read under the same lock. Different
accounts do not wait on each other.

### Conflict rule

Per incoming row, in parent-first table order (clients, projects, milestones,
checklist_items, notes, invoices, invoice_lines, time_entries, payments,
settings):

1. Validate against the shared push-row schema; a failure rejects the row as
   `forbidden` (validation), not the whole request.
2. Every parent it references (`clientId`, `projectId`, `invoiceId`, …) must
   exist for this user — either already, or earlier in this same request. If
   not, the row is rejected `missing_parent`. This is what turns a foreign key
   failure from a 500 for the batch into a fact about one row, and it is also
   the tenancy check: a parent that exists but belongs to someone else does
   not count.
3. Load the stored row by `(id, user_id)`. A stored row with that id under
   another user is `forbidden`.
4. If there is none: insert, `updated_by = deviceId`, fresh `server_seq`.
5. If the incoming `updatedAt` is strictly newer than stored: update all
   columns, `updated_by = deviceId`, fresh `server_seq`.
6. If they are equal: the tie is broken by device id — the incoming row wins
   only if `deviceId > stored.updated_by` as strings (a `null` stored device
   always loses). Two devices that both apply this rule to the same pair of
   versions choose the same one, which is what makes the tie deterministic.
   A device re-sending its own row (same `updatedAt`, same device) is an
   equal id and therefore not a win: nothing is written, and the row is
   already what the server has.
7. Otherwise the incoming row is older: nothing is written. The stored
   winner is added to this response's `changes` **regardless of its
   `server_seq`**, so a client whose clock is behind still learns it lost.
   "Letting the pull return the winner" holds by construction rather than
   by luck.

Settings is the same rule keyed on `user_id`.

### Pull

After the pushes, every row of this user's with `server_seq > since`, across
all tables, ordered by `server_seq`, capped at `SYNC_PAGE_SIZE` rows (default
500). Each table is queried with `LIMIT pageSize + 1` and the results merged,
so memory is bounded. `hasMore` is whether a row beyond the cap existed;
`cursor` is the `server_seq` of the last row returned, or `since` if there
were none. Rows pushed in this same request come back in this pull as echoes;
applying them is a no-op on the client, and it is what makes a crash between
the server's commit and the client's cheap to recover from.

Within a page rows are grouped by table in parent-first order. Across pages
no such guarantee is possible — a client updated after its project has a
higher sequence than the project — which the client handles (below).

### Route

`src/sync/router.ts`: `requireAuth`, its own `express.json({ limit: '8mb' })`
(a settings logo is a data URL), parse with `syncRequestSchema`, call
`runSync(db, userId, request, { pageSize })`, answer with the response. The
existing error handler covers the failure shapes.

`src/sync/service.ts` holds `runSync` and nothing Express-shaped.
`src/sync/tables.ts` is the registry: table name → Drizzle table, parent
columns, push/pull schemas, and the two conversions between wire rows (ISO
strings) and Drizzle rows (`Date`).

## Client (main process)

`apps/desktop/src/main/sync/`, plain functions over `Database` plus a
transport and an auth service handed in, unit-tested without Electron.

### Local state — migration `002_sync.sql`

```
sync_meta       key TEXT PRIMARY KEY, value TEXT      -- cursor, deviceId, lastSyncedAt, accountUserId
sync_conflicts  id, table_name, row_id, kind ('record' | 'reorder'), project_id,
                label, fields (JSON), local (JSON), remote (JSON),
                detected_at, resolved_at, resolution
sync_events     id, kind ('synced' | 'failed' | 'conflict'), at, detail     -- the popover's log, pruned to 50
```

`pendingKindSchema` gains `clients`; checklist items, milestones and notes
count under `projects`. Every table is now counted, so "waiting to upload"
can never say 0 while a row waits.

### One run

`runSync(ctx)`, guarded so two never overlap (an in-flight promise; a request
during a run sets a flag and one more run follows). Each iteration:

1. `outbox.collect(db, cap)`: pending rows, parent-first, at most `cap` (500)
   across tables, each remembered with the `updatedAt` it was read at.
2. Fetch an access token from the auth service (`unauthorized` → the run
   fails `signedOut` without touching the network).
3. POST. Transport errors map to failure reasons: no response → `offline`;
   401 → one `auth.verify()` and one retry, then `signedOut`; 426 → `tooOld`;
   anything else → `server`.
4. In **one SQLite transaction**, with foreign-key enforcement off for its
   duration (see below):
   - mark each pushed row `synced` **only where `updated_at` still equals the
     value it was read at** — an edit made while the request was in flight
     stays pending — and never a row rejected `missing_parent`;
   - apply every row in `changes` (rule below);
   - write `cursor` and `lastSyncedAt` to `sync_meta`.
   A crash anywhere before the commit leaves every pushed row pending and the
   cursor where it was; the next run re-pushes, the server answers with
   echoes, and the client converges. Nothing is ever lost and the cursor
   never passes data that was not applied.
5. Loop while `hasMore` or the outbox still had rows beyond the cap.

Foreign keys: because a child can arrive a page before its parent, the apply
transaction runs with `PRAGMA foreign_keys = OFF` (set before `BEGIN`,
restored after `COMMIT`). Within a page the parent-first order still holds.
The consequence is a brief window during a multi-page pull — a second
machine's first hydration, a long-offline client — in which a row may
reference a parent not yet arrived; the renderer's list queries tolerate that
as they tolerate any filtered-out parent.

### Apply rule (per incoming row)

```
local = any row with this id, deleted or not
none            → insert as synced (tombstones included: a second machine gets the same history)
local synced    → write incoming if incoming.updatedAt >= local.updatedAt; else ignore
local pending   → incoming wins if incoming.updatedAt > local.updatedAt,
                  or equal and incoming.updatedBy > deviceId
                    wins  → if the content differs, record a conflict; write incoming as synced
                    loses → if equal updatedAt and updatedBy == deviceId (our own echo) mark synced;
                            otherwise leave the local row exactly as it is
```

"Content differs" compares every field except `updatedAt` and `syncState`.

Applying the same response twice is a no-op the second time: every row is
already synced with an equal `updatedAt`, so it is rewritten with itself, no
conflict is recorded (conflicts need a pending local row), and the cursor is
set to the value it already has.

### Conflicts

A conflict is a local pending edit that lost. It records the table, id, a
human label for the record (name, number, label, the first line of a note,
the project name of a time entry), the fields that differed, the losing local
version and the winning remote one. Kind is `reorder` when the table is
`checklist_items` and the only differing field is `sortOrder`; otherwise
`record`. Each conflict also writes a `conflict` event to the log.

Resolutions, over the bridge:

- `keepTheirs` — dismiss; marks the conflict resolved.
- `restoreMine` — writes the losing local version's fields back as a fresh
  local edit (new `updatedAt`, `pending`), so it wins the next sync
  everywhere. For a `reorder` this restores `sortOrder` alone.

A lost local *delete* (edited elsewhere afterwards) and a lost local *edit*
(deleted elsewhere afterwards) are both `record` conflicts; the notice's
wording reads the two `deletedAt`s. Both restore the same way.

### Monotonic `updatedAt`

`updateRow` and `updateSettings` stamp `updatedAt = max(now, current.updatedAt + 1 ms)`.
Without this, a machine whose clock is behind another's would lose every
edit it makes on top of a row it just pulled — an edit you make *on top of*
a version you have seen must always beat that version.

### Triggers

- launch (after the window is up and `auth.verify()` has been called);
- every 60 seconds;
- network regain: the renderer's `online` event calls `sync.now()`;
- the Sync now buttons (popover and Settings › Account).

### Account binding

The first successful sync records the account's user id in `sync_meta`. A
later sync as a different account fails with a new reason, `otherAccount`
("This data belongs to another account"), rather than uploading one person's
ledger into another's. Switching accounts on one machine is a product
decision this work does not make; it refuses safely and says why.

### Status

```
{ state: 'saved' | 'syncing' | 'pending' | 'failed',
  lastSyncedAt: timestamp | null,
  pending: PendingCounts,
  failure?: 'offline' | 'signedOut' | 'server' | 'tooOld' | 'otherAccount',
  log: SyncEvent[],            // last 20 events, newest first
  revision: number }           // bumps whenever a sync changed local data
```

Derived, never stored: `syncing` while a run is in flight; else `failed` if
the last run failed; else `pending` if anything is pending; else `saved`.

## Bridge

`LedgerApi.sync`:

| Method | Does |
|---|---|
| `status()` | the status above |
| `now()` | runs a sync (queued after one in flight) and answers with the status after it |
| `onChanged(listener)` | pushed on every status move; the renderer invalidates every query when `revision` changes |
| `conflicts()` | unresolved conflicts, newest first |
| `resolveConflict(id, resolution)` | `keepTheirs` or `restoreMine` |

`data.sync.pendingCounts` stays; the status carries the same counts.

## Renderer

- `sync-data.ts` keeps its labels, tones and fixtures, and re-exports the
  types from the shared schemas instead of declaring them. `failureReasons`
  gains `otherAccount`; `pendingLabels` gains `clients`.
- `useSyncStatus()` reads once and is kept current by `sync:changed`, the
  way the update and auth statuses are. `useSyncNow()`, `useConflicts()`,
  `useResolveConflict()`.
- The sidebar footer, popover and Settings › Account read the live status.
  The Sync now buttons call `now()`. The panel's Sync lever gains a `live`
  option, which is the default; the four forced states override the live
  snapshot with the fixtures exactly as before.
- The record conflict notice moves to the shell's notice bar (where the
  update notice lives), because the record can be a client or an invoice as
  well as a project. It names the record and the fields, says which side
  won, and offers **Keep the other version** and **Restore my version**. The
  reorder notice stays on the project checklist for the project concerned
  and offers **Restore my order**. The panel's Notice lever forces both with
  sample copy, as now.

## Tests

Unit (root `npm test`): shared sync schemas; outbox collection and the CAS
mark; the apply rule, table by table, including idempotency; conflict
detection and both resolutions; the engine's guard, status derivation and
failure mapping against a fake transport; monotonic `updatedAt`.

Server integration (`npm run test:integration -w @trackit/server`):
`src/sync/sync.integration.test.ts` — insert, strictly-newer wins, older is
superseded and the winner is echoed, the device tie-break, one sequence
across tables, pagination and `hasMore`, `missing_parent`, tenancy,
protocol version, settings.

**Two devices, one server** — `tests/sync/two-devices.integration.test.ts`,
run by `npm run test:sync` at the root, with a README beside it. Two
in-memory SQLite databases, each with a real sync engine, talking to the
real Express app through supertest against the test Postgres. One `describe`
per scenario the brief names:

1. concurrent edits to one record;
2. concurrent checklist reordering — disjoint moves merge with no conflict,
   the same item moved twice ends in the same order on both machines with a
   reorder conflict on the loser;
3. delete versus edit, both ways;
4. a long-offline client — many pages in both directions, and a second
   machine hydrating from `since: 0`;
5. a mid-sync crash — after the server commits but before the client
   applies, and inside the apply transaction — with recovery to the same
   state a clean run reaches.

Every scenario ends by asserting both databases hold identical rows.

## Out of scope, and known limits

- A running timer (`endedAt = null`) is a row like any other and syncs. A
  second machine will see it running. Stopping it there stops it
  everywhere, which is arguably right; the recovery dialog and the
  `before-quit` close may also act on it, which is a timer-semantics
  question for its own change.
- Device names. The notices say "another device".
- Switching accounts on one machine (refused, above).
