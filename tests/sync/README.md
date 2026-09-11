# Two devices, one server

The sync engine's acceptance tests. Two in-memory Trackit ledgers, each
under a real sync engine (`apps/desktop/src/main/sync`), talk over HTTP to
the real Express app (`apps/server`) on the test Postgres. Every scenario
ends by checking that both ledgers hold the same rows and that neither has
anything left to upload.

```
npm run test:sync
```

Needs the same Postgres as the server's integration tests: bring up
`apps/server/docker-compose.yml`, or point `DATABASE_URL` somewhere.

| Scenario | File section | What it proves |
|---|---|---|
| Concurrent edits to one record | `1.` | The later edit wins on both machines; the machine whose edit lost sees a conflict, and can restore its version, which then wins everywhere. Ties on the instant are broken by device id, identically on both sides. |
| Concurrent checklist reordering | `2.` | Moves of different items merge with nothing to report; the same item moved twice ends where the later move put it, with a reorder notice on the other machine. |
| Delete versus edit | `3.` | Whichever is later wins, both ways; the loser is told which side deleted. |
| A long-offline client | `4.` | A second machine hydrates the whole history from `since: 0` in pages; a machine that comes back after many changes on both sides converges; a child that arrives a page before its parent is fine. |
| A mid-sync crash | `5.` | A crash after the server committed but before the client applied, and a crash inside the apply transaction: nothing is lost, the cursor never passes unapplied data, and recovery ends where a clean run ends. |
| Two drafts raised offline | `6.` | Both devices guess the same provisional invoice number. The server issues each its own on the first sync through; the swap is in the log, both ledgers agree, and a draft deleted before it ever synced burns no number. |

`harness.ts` is the fixture: `startServer()`, `createDevice()`, `expectSameLedger()`,
and a `Clock` that steps only `Date`, so which edit is newer is a fact of
the scenario rather than of the machine running it.

The rule these scenarios exercise is written up in
`docs/superpowers/specs/2026-09-10-sync-engine-design.md`. The server side
of it is tested on its own in `apps/server/src/sync/sync.integration.test.ts`;
the client side in `apps/desktop/src/main/sync/*.test.ts`.
