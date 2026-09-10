# Sync Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Trackit's local ledger sync between machines through `POST /sync`, with last-writer-wins resolution, an interruption-safe client engine, and the existing footer, popover and conflict notices reporting real state.

**Architecture:** The server gains one route backed by a plain `runSync(db, userId, request)` that runs in a transaction under a per-user advisory lock, upserting strictly-newer rows and paging the user's rows by a single shared sequence. The desktop main process gains `src/main/sync/` — outbox, apply, conflicts, engine, transport — plain functions over `Database`, exposed through five named bridge methods. The renderer reads the status the way it reads the update and auth statuses.

**Tech Stack:** Zod 4 (shared schemas), Express 5 + Drizzle + pg (server), better-sqlite3 (desktop main), TanStack Query (renderer), Vitest, supertest.

**Spec:** `docs/superpowers/specs/2026-09-10-sync-engine-design.md`

## Global Constraints

- Every type comes from a Zod schema in `packages/shared`; never redeclare.
- Money integer cents; timestamps UTC ISO strings; ids client-minted UUIDv4; soft deletes only.
- Main-process logic in plain functions taking `db`; no Electron imports inside them.
- IPC handlers validate with shared schemas and answer `Result`; never throw across the bridge.
- No raw colours in components; no new UI framework or state library.
- Schema changes only through new numbered migrations (`002_sync.sql` desktop, `0001_sync` server).
- Files have mixed CRLF/LF; use the Edit tool, never `sed -i`.
- Commits under the user's own identity, no Claude trailer; never commit CLAUDE.md.
- The States panel must reach every new state.

---

### Task 1: Shared sync schemas

**Files:**
- Modify: `packages/shared/src/schemas/sync.ts`
- Test: `packages/shared/src/schemas/sync.test.ts`

**Produces:**
- `syncTableNameSchema`, `SYNC_TABLE_ORDER` (parent-first tuple), `SyncTableName`
- `syncPushRowSchemas: Record<SyncTableName, ZodObject>` (entity minus `syncState`; settings minus `theme`, `accountEmail`, `syncState`)
- `syncPullRowSchemas` = push rows `.extend({ updatedBy: idSchema.nullable() })`
- `syncRequestSchema` `{ protocolVersion: z.literal(1), deviceId, since: int ≥ 0, changes: object of optional arrays }`
- `syncResponseSchema` `{ cursor, hasMore, changes, rejected: [{ table, id, reason }] }`, `SYNC_PROTOCOL_VERSION = 1`
- `pendingKindSchema` gains `'clients'`
- `syncFailureSchema`, `syncEventSchema`, `syncStatusSchema`, `syncConflictSchema`, `conflictResolutionSchema`

- [ ] Write tests: a client entity with `syncState` parses as a push row with `syncState` stripped; a settings push row rejects `theme`; the request rejects `protocolVersion: 2`; a response round-trips; `SYNC_TABLE_ORDER` lists parents before children.
- [ ] Implement; run `npm test -- packages/shared`; commit.

### Task 2: Server — one sequence and `updated_by`

**Files:**
- Modify: `apps/server/src/db/schema.ts` (`pgSequence('sync_seq')`, `serverSeq: bigint default nextval`, `updatedBy: uuid` on all syncable tables)
- Create: `apps/server/drizzle/0001_sync.sql` (+ journal entry, snapshot via `drizzle-kit generate` then hand-fixed to drop per-table sequences)
- Test: `apps/server/src/sync/sync.integration.test.ts` (first case)

- [ ] Test: after migrate, inserting into two tables yields increasing `server_seq` from one sequence (`SELECT last_value FROM sync_seq`).
- [ ] Implement migration and schema; run `npm run test:integration -w @trackit/server`; commit.

### Task 3: Server — table registry and `runSync`

**Files:**
- Create: `apps/server/src/sync/tables.ts`, `apps/server/src/sync/service.ts`
- Test: `apps/server/src/sync/sync.integration.test.ts`

**Produces:** `runSync(db: Db, userId: string, request: SyncRequest, options: { pageSize: number; deviceId: string }): Promise<SyncResponse>`

- [ ] Tests (each against the real Postgres): insert → pull echoes it with `updatedBy`; strictly newer wins; older is superseded and the winner is echoed even when its seq ≤ since; equal `updatedAt` broken by device id, both directions; the same device re-sending is a no-op; missing parent rejected and the rest of the batch stored; a parent of another user counts as missing; a row id owned by another user is `forbidden`; pagination `pageSize=2` walks all rows with correct cursors and `hasMore`; settings upsert; invalid row → `forbidden` without failing the batch.
- [ ] Implement `tables.ts` (name → drizzle table, parents, wire↔row conversion) and `service.ts` (transaction, `pg_advisory_xact_lock(hashtext($1))`, push loop, pull merge).
- [ ] Run; commit.

### Task 4: Server — route

**Files:**
- Create: `apps/server/src/sync/router.ts`
- Modify: `apps/server/src/app.ts`, `apps/server/src/config.ts` (`SYNC_PAGE_SIZE`), `apps/server/src/errors.ts` (`upgrade_required`), `.env.example`
- Test: extend `sync.integration.test.ts`

- [ ] Tests via supertest: 401 without token; 400 on a bad body; 426 `upgrade_required` on `protocolVersion: 0`; a 2 MB body accepted; happy path.
- [ ] Implement; run; commit.

### Task 5: Desktop — migration 002, meta, monotonic `updatedAt`, pending counts

**Files:**
- Create: `apps/desktop/src/main/db/migrations/002_sync.sql`, `apps/desktop/src/main/sync/meta.ts`
- Modify: `apps/desktop/src/main/repositories/table.ts`, `settings.ts`, `sync.ts`
- Test: `apps/desktop/src/main/sync/meta.test.ts`, `repositories/table.test.ts` (new), `repositories/sync.test.ts`

**Produces:** `readMeta(db, key)`, `writeMeta(db, key, value)`, `deviceId(db)` (mints once), `cursor(db)`, `setCursor`, `lastSyncedAt`, `accountUserId`; `bumpedUpdatedAt(current: string, now: string): string`.

- [ ] Tests: meta round-trip; device id stable across calls; `updateRow` on a row whose `updatedAt` is in the future yields `updatedAt` = that + 1 ms; pending counts include clients and fold checklist/milestones/notes into projects.
- [ ] Implement; run `npm test`; commit.

### Task 6: Desktop — outbox

**Files:**
- Create: `apps/desktop/src/main/sync/tables.ts` (registry over the repository `Table`s + settings), `apps/desktop/src/main/sync/outbox.ts`
- Test: `apps/desktop/src/main/sync/outbox.test.ts`

**Produces:** `collectPending(db, cap): { changes: SyncRequest['changes']; pushed: PushedRef[]; more: boolean }` where `PushedRef = { table, id, updatedAt }`; `markSynced(db, pushed: PushedRef[], skip: Set<string>)` (CAS on `updated_at`).

- [ ] Tests: parent-first order; cap respected with `more: true`; settings pushed without theme/accountEmail; `markSynced` leaves a row edited after collection pending; skipped refs stay pending.
- [ ] Implement; run; commit.

### Task 7: Desktop — apply and conflicts

**Files:**
- Create: `apps/desktop/src/main/sync/apply.ts`, `apps/desktop/src/main/sync/conflicts.ts`, `apps/desktop/src/main/sync/describe.ts`
- Test: `apply.test.ts`, `conflicts.test.ts`

**Produces:** `applyResponse(db, response, ctx: { deviceId; pushed; now }): { applied: number; conflicts: number }` (runs inside the caller's transaction); `listConflicts(db)`, `resolveConflict(db, id, resolution)`, `recordEvent(db, kind, detail, at)`, `listEvents(db, limit)`.

- [ ] Tests: insert new; overwrite synced; ignore older over synced; pending loses → conflict recorded with fields and label, row overwritten and synced; pending wins → untouched; own echo → marked synced; equal-time tie by device; reorder kind for sortOrder-only checklist loss; delete-vs-edit both ways; settings apply keeps theme; applying the same response twice changes nothing (`SELECT *` snapshots equal, no new conflicts); `restoreMine` produces a pending row with a newer `updatedAt` and the local fields; `keepTheirs` resolves only.
- [ ] Implement; run; commit.

### Task 8: Desktop — transport and engine

**Files:**
- Create: `apps/desktop/src/main/sync/client.ts`, `apps/desktop/src/main/sync/engine.ts`
- Test: `client.test.ts`, `engine.test.ts`

**Produces:**
- `createSyncClient({ baseUrl, fetch? }): SyncTransport` where `SyncTransport = { push: (token: string, request: SyncRequest) => Promise<SyncResponse> }`, throwing `SyncClientError(code)` with `code ∈ ApiErrorCode | 'upgrade_required'`.
- `createSyncEngine({ db, transport, auth: { accessToken; verify; status }, onChanged, now?, intervalMs?, pageSize? }): SyncEngine` with `sync(): Promise<SyncStatus>`, `status(): SyncStatus`, `start()`, `stop()`, `conflicts()`, `resolveConflict()`; test hooks `beforeApply?` / `beforeCommit?` for crash injection.

- [ ] Client tests: bearer header and body; 426 → `upgrade_required`; network → `offline`; error body codes mapped.
- [ ] Engine tests with an in-memory DB and a fake transport: happy run marks synced, stores cursor, status `saved`; `hasMore` loops; outbox `more` loops; concurrency guard (second `sync()` during a run yields one follow-up run, never overlap); failures map to reasons and status `failed` with pending counts kept; 401 → verify + retry once; `otherAccount`; crash before apply leaves pending and cursor; crash inside apply rolls back; `revision` bumps only when data changed; events logged; FK pragma restored after apply even on throw.
- [ ] Implement; run; commit.

### Task 9: Bridge, IPC, main wiring

**Files:**
- Modify: `packages/shared/src/api.ts` (`LedgerApi.sync`), `apps/desktop/src/preload/index.ts`, `apps/desktop/src/renderer/src/bridge.ts`, `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/main/sync-ipc.ts`

- [ ] Add the five methods; register handlers with `handle(...)`; construct the engine in `index.ts` after auth, `start()` after `auth.verify()`, `stop()` on `before-quit`; push `sync:changed`.
- [ ] `npm run typecheck`; commit.

### Task 10: Renderer — live status, notices, panel

**Files:**
- Modify: `components/sync-data.ts`, `data/keys.ts`, `data/use-sync.ts`, `components/Sidebar.tsx`, `SyncStatus.tsx`, `SyncPopover.tsx`, `SettingsAccount.tsx`, `SettingsScreen.tsx`, `ConflictNotice.tsx`, `ProjectDetail.tsx`, `ProjectChecklist.tsx`, `App.tsx`, `dev/StatePanel.tsx`
- Test: `components/sync-data.test.ts` (snapshot conversion, labels)

- [ ] `useSyncStatus` (query + `onChanged`, invalidates all on `revision` change), `useSyncNow`, `useConflicts`, `useResolveConflict`.
- [ ] `toSnapshot(status)` converts ISO → epoch ms; forced panel state overrides; `SyncState` lever adds `live`.
- [ ] Record notice in the shell bar with real copy and two actions; reorder notice on the checklist for its project; panel forcing keeps sample copy.
- [ ] `online` event → `sync.now()`. Typecheck, `npm test`; commit.

### Task 11: Two-devices integration suite

**Files:**
- Create: `tests/sync/README.md`, `tests/sync/harness.ts`, `tests/sync/two-devices.integration.test.ts`, `tests/sync/vitest.config.ts`
- Modify: root `package.json` (`test:sync`), `README.md` (pointer)

- [ ] Harness: `startServer()` (app + test db + one registered user, token per device), `createDevice(name)` (memory SQLite, engine with supertest transport, hooks for crash injection), `snapshot(db)` (every syncable table's rows minus `sync_state`, sorted), `expectSameLedger(a, b)`.
- [ ] Scenarios 1–5 from the spec, each ending with `expectSameLedger`.
- [ ] Run `npm run test:sync`; commit.

### Task 12: Verification and docs

- [ ] `npm run typecheck`, `npm test`, `npm run test:integration -w @trackit/server`, `npm run test:sync`.
- [ ] Manual: run server + app, sign in, create a client, watch the footer go pending → syncing → saved; second userData dir hydrates.
- [ ] Update `apps/server/README`/root README notes; commit.
