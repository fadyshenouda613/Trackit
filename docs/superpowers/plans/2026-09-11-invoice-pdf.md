# Invoice PDF and Server-Issued Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Download PDF" real — rendered on the server from the printed-invoice design, fetched through main, cached, stamped — and move invoice numbering to the server so two devices can never mint the same number.

**Architecture:** The server gains two routes under `/invoices`: a mint (`POST /:id/number`, a reservation under the account's advisory lock) and a render (`GET /:id/pdf`, a pure HTML template printed by one long-lived Puppeteer browser). The desktop's create handler asks for a number first and falls back to a provisional local one; the sync engine swaps provisional numbers at the start of a run. `LedgerApi.pdf` is three thin handlers over plain functions in `src/main/pdf/`.

**Tech Stack:** Zod 4, Express 5 + Drizzle + pg, Puppeteer, better-sqlite3, TanStack Query, Vitest, supertest.

**Spec:** `docs/superpowers/specs/2026-09-11-invoice-pdf-design.md`

## Global Constraints

- Every type comes from a Zod schema in `packages/shared`; never redeclare.
- Money integer cents; timestamps UTC ISO strings; ids client-minted UUIDv4; soft deletes only.
- Main-process logic in plain functions taking `db`; no Electron imports inside them.
- IPC handlers validate with shared schemas and answer `Result`; never throw across the bridge.
- No raw colours in components; the sheet's CSS is the sanctioned exception and stays sealed.
- Schema changes only through new numbered migrations (`003_invoice_numbers.sql` desktop, `0002_invoice_numbers` server).
- Files have mixed CRLF/LF; use the Edit tool, never `sed -i`.
- Commits under the user's own identity, no Claude trailer; never commit CLAUDE.md.
- The States panel must reach every new state.

---

### Task 1: Shared schema — `numberProvisional`, `pdfGeneratedAt`, the mint and PDF shapes

**Files:**
- Modify: `packages/shared/src/schemas/invoice.ts`
- Create: `packages/shared/src/schemas/invoice-pdf.ts` (mint input/output, `invoicePdfSchema`)
- Modify: `packages/shared/src/schemas/index.ts`, `packages/shared/src/api.ts`
- Test: `packages/shared/src/schemas/schemas.test.ts`

**Produces:**
- `invoiceFields.numberProvisional: z.boolean()`, `pdfGeneratedAt: timestampSchema.nullable()`
- `newInvoiceInputSchema` without `number`
- `mintInvoiceNumberInputSchema = { scheme: numberingSchemeSchema }`, `mintedInvoiceNumberSchema = { invoiceId, number }`
- `invoicePdfSchema = { invoiceId, path, generatedAt, cached }`
- `LedgerApi.pdf: { generate, reveal, saveAs }`; `DataApi.invoices.update` comment loses "number"

- [ ] Tests: an invoice parses with both fields; `newInvoiceInputSchema` rejects `number`; the mint input rejects a scheme with no counter.
- [ ] Implement; `npm test -- packages/shared`; typecheck fails everywhere the fields are missing — that is Tasks 2–4.

### Task 2: Desktop store — migration, repository functions

**Files:**
- Create: `apps/desktop/src/main/db/migrations/003_invoice_numbers.sql`
- Modify: `apps/desktop/src/main/repositories/invoices.ts` (`invoicesTable.booleans`, `createInvoice` takes `{ number, numberProvisional }`, `updateInvoice` refuses `number`, new `listProvisionalInvoices`, `assignInvoiceNumber`, `markPdfGenerated`)
- Modify: `apps/desktop/src/main/seed/seed.ts`, `fixtures.ts` (INV-0149 provisional)
- Test: `apps/desktop/src/main/repositories/invoices.test.ts`

**Produces:**
- `createInvoice(db, input, numbering: { number: string; numberProvisional: boolean })`
- `listProvisionalInvoices(db): Invoice[]` — live, `number_provisional = 1`
- `assignInvoiceNumber(db, id, number): Invoice` — clears the flag, ordinary edit
- `markPdfGenerated(db, id, at): Invoice` — any status

- [ ] Tests first; implement; `npm test -- apps/desktop/src/main/repositories`.

### Task 3: Server — migration, mint route, render route, template, Puppeteer

**Files:**
- Modify: `apps/server/src/db/schema.ts`; generate `apps/server/drizzle/0002_invoice_numbers.sql`
- Create: `apps/server/src/invoices/numbers.ts` (`mintInvoiceNumber(db, userId, invoiceId, scheme, now)`)
- Create: `apps/server/src/invoices/document.ts` (`loadInvoiceDocument(db, userId, invoiceId): Promise<InvoiceDocument | null>`)
- Create: `apps/server/src/invoices/template.ts` (`renderInvoiceHtml(document, assets)`), `paper-css.ts`, `fonts.ts`
- Create: `apps/server/src/invoices/pdf.ts` (`createPdfRenderer({ args }): { render(html), close() }`)
- Create: `apps/server/src/invoices/router.ts`
- Modify: `apps/server/src/app.ts`, `config.ts`, `index.ts`, `package.json`, `Dockerfile`, `scripts/build.mjs`
- Test: `apps/server/src/invoices/template.test.ts` (snapshot + drift), `apps/server/src/invoices/invoices.integration.test.ts`

- [ ] Snapshot test first with a fixed document; template; drift check.
- [ ] Integration tests: ownership (200 / 404 / 401), minting (sequential, idempotent, counts uploaded, ignores provisional).
- [ ] `npm run test:integration -w @trackit/server` against a local Postgres.

### Task 4: Desktop — number at create, the engine's swap, the PDF service, IPC, preload, bridge

**Files:**
- Modify: `apps/desktop/src/main/sync/client.ts` (`mintNumber`), `engine.ts` (swap before the loop)
- Create: `apps/desktop/src/main/sync/numbers.ts` (`numberForNewInvoice`, `assignServerNumbers`)
- Create: `apps/desktop/src/main/pdf/client.ts`, `service.ts`, tests
- Create: `apps/desktop/src/main/pdf-ipc.ts`; modify `data-ipc.ts` (create becomes async through deps), `index.ts`, `preload/index.ts`, `renderer/src/bridge.ts`
- Test: `engine.test.ts`, `numbers.test.ts`, `pdf/service.test.ts`

- [ ] Engine test: a provisional draft is numbered by the transport before the push and the log says so; a mint failure fails the run.
- [ ] Service test: sync first; pending after sync refuses; cache hit on unchanged updatedAt; re-render after an edit; the stamp.

### Task 5: Renderer — the button, the reasons, the toast actions, the marks, the panel

**Files:**
- Modify: `InvoiceActions.tsx`, `InvoiceDetail.tsx`, `InvoiceDocument.tsx`, `InvoicesTable.tsx`, `InvoiceRail.tsx`, `InvoiceScreen.tsx`, `invoices-data.ts`, `Toast.tsx`, `toast-data.ts`, `App.tsx`, `dev/StatePanel.tsx`, `data/use-invoices.ts` (`useGeneratePdf`, `useRevealPdf`, `useSavePdfAs`), `data/keys.ts`, `components/use-online.ts` (new), `styles/app.css`
- Test: `invoices-data.test.ts` (`pdfAvailability`)

- [ ] Typecheck web; the panel reaches Connection: offline and the provisional draft.

### Task 6: Two devices — scenario 6

**Files:**
- Modify: `tests/sync/harness.ts` (transport with mint), `tests/sync/two-devices.integration.test.ts`, `tests/sync/README.md`

- [ ] Both devices draft offline with the same provisional number; both sync; numbers differ; ledgers equal; log line present.

### Task 7: Verify, document, commit

- [ ] `npm run typecheck`, `npm test`, `npm run test:integration -w @trackit/server`, `npm run test:sync`, `npm run build`.
- [ ] Drive the real app: create a draft offline (server down) → provisional pill; start the server → sync swaps it; Download PDF → file in the cache, toast, `pdfGeneratedAt` set; offline → button disabled with the reason.
- [ ] README/CLAUDE notes; commits per task under the user's identity.
