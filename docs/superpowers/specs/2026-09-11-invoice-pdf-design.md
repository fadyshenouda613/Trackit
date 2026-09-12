# Invoice PDF and server-issued numbers — design

Date: 2026-09-11. Branch: `feat/invoice-pdf`, off `feat/sync-engine`.

## What this is

The printed invoice exists as a screen — an A4 sheet drawn by the renderer
at true size, sealed off from the app's theme — and the rail beside every
invoice has had an inert "Download PDF" button since the first artboard. This
work makes that button real, and closes the one hole the sync engine left
open: two machines drafting offline could mint the same invoice number.

Two changes, tied together because the second is what makes the first
correct:

1. **The server renders the PDF.** `GET /invoices/:id/pdf` builds an HTML
   document from the invoice, its lines, its client and the account's
   business settings, and prints it to A4 with Puppeteer. The desktop asks
   for it through the main process, keeps the bytes, and stamps the invoice
   `pdfGeneratedAt`.
2. **The server issues invoice numbers.** A draft raised while the server is
   reachable takes its number from `POST /invoices/:id/number`. A draft
   raised offline holds the number the local scheme produces, flagged
   provisional, and the sync engine swaps it for a server number at the
   start of the first sync that can reach the server. The server never
   stores a provisional number.

Everything else the repository holds — money as cents, UTC timestamps,
client-minted ids, soft deletes, logic in plain functions over a `db`
handle, a thin typed bridge, no raw colours in components — stands.

## The invoice row

Two fields join `invoiceFields` in `packages/shared/src/schemas/invoice.ts`,
and travel with the row everywhere it goes:

| Field | Type | Meaning |
|---|---|---|
| `numberProvisional` | `boolean` | The number was produced locally and has not been confirmed by the server. |
| `pdfGeneratedAt` | `timestamp \| null` | When a PDF of this invoice was last rendered. |

Desktop migration `003_invoice_numbers.sql` adds `number_provisional INTEGER
NOT NULL DEFAULT 0` and `pdf_generated_at TEXT` to `invoices`. Server
migration `0002_invoice_numbers` adds the same two columns to `invoices` and
creates `invoice_numbers`:

```
invoice_numbers
  invoice_id   uuid primary key
  user_id      uuid not null references users
  number       text not null
  reserved_at  timestamptz not null
  unique (user_id, number)
```

A row here is a number the server has handed out for an invoice, whether or
not that invoice has been uploaded yet. It is what makes the mint idempotent
and what stops a number being handed out twice between the mint and the
upload.

## Numbering

### The endpoint

```
POST /invoices/:id/number
Authorization: Bearer <access token>
{ scheme: "INV-0000" }

200 { invoiceId, number }
```

The route runs one transaction under `pg_advisory_xact_lock(hashtext(userId))`
— the same lock `POST /sync` takes, so a mint and a sync for one account are
serial and a row being uploaded cannot slip past the count. Inside it:

1. If `invoice_numbers` already has a row for this invoice id, answer with
   its number. A retry after a lost response costs nothing.
2. Otherwise the used numbers are every `invoices.number` of the account
   where `number_provisional` is false (deleted drafts included, exactly as
   the desktop's `nextNumber` counts) plus every `invoice_numbers.number` of
   the account.
3. `nextInvoiceNumber(scheme, nextInvoiceSequence(used, scheme), now)` — the
   shared helper, the same call the desktop makes — is the number. A scheme
   with no counter fails validation at the door (`numberingSchemeSchema`).
4. Insert the reservation and answer.

The scheme is the client's. It is a setting, and settings sync like every
other row; what only the server can guarantee is that a counter value is
handed out once, and that guarantee holds whatever scheme the number is
written in. Two devices whose settings have not yet converged get
differently shaped numbers, which is not a collision, and once they converge
the sequence continues from the higher of the two.

### Raising a draft

`invoices:create` on the desktop is now an async handler. Before calling the
plain `createInvoice`, it asks the server for a number with a short timeout:

- Signed in, session active, server answers: the draft is stored with that
  number and `numberProvisional: false`.
- Anything else — signed out, expired, offline, a timeout, a 5xx: the draft
  is stored with `nextNumber(db)` and `numberProvisional: true`.

The number is no longer typed. `newInvoiceInputSchema` loses `number`; the
create screen's rail shows the number the scheme expects, read-only, with
the note that it is issued on save. `updateInvoice` no longer accepts
`number` on a draft.

### The swap

At the start of every run, after the signed-in check and before the first
outbox is collected, the engine lists live invoices with
`number_provisional = 1`, and for each one calls the mint endpoint with the
current scheme and writes the answer back with `assignInvoiceNumber(db, id,
number)` — an ordinary edit: `updatedAt` bumped, `syncState` pending — and
records a `synced` event: `Draft INV-0150 is now INV-0151` (or `Draft
INV-0151 kept its number` when the server confirmed what the scheme had
guessed). The row then goes up in the same run with its final number. A
mint that fails fails the run the way any exchange does.

Deleted provisional drafts are left alone: a tombstone needs no number, and
its provisional flag travels as the fact that it never had one.

### In the UI

The number is marked provisional wherever it is shown as the invoice's
identity: a small neutral pill on the Invoices list row, beside the number
on the in-app document, and in the rail's status aside on a draft ("Not
issued. The number is provisional until this draft has synced."). The
document's draft note says which it is: reserved, or provisional. The sync
popover's log carries the swap line.

## The PDF

### The endpoint

```
GET /invoices/:id/pdf
Authorization: Bearer <access token>

200 application/pdf
Content-Disposition: attachment; filename="INV-0145.pdf"
```

Ownership is the query: the invoice is loaded by `(id, user_id)`, and an
invoice that is not the caller's is a 404 `not_found`, the same answer as an
invoice that does not exist. Nothing distinguishes the two from outside.

The route loads the live rows — the invoice, its lines in sort order, the
client, the names of the projects the lines point at, the account's settings
row (defaults when the account has never uploaded one) — and hands them as
plain data to `renderInvoiceHtml`, a pure function in
`apps/server/src/invoices/template.ts`. The HTML goes to
`apps/server/src/invoices/pdf.ts`, which owns one Puppeteer browser per
process (launched on first use, closed on shutdown) and prints the page to
A4 with backgrounds on and `preferCSSPageSize`.

### The template

The sheet is the renderer's `PrintedInvoice`, reproduced: the same
structure, class names and reading order, the same figures through the same
shared helpers (`formatCents`, `shortDate`, `symbolOf`, the terms label and
the payment-terms prose), grouped by project with a per-group subtotal only
when there is more than one group, the tax row only when the rate is above
zero, the bank block and the reference at the foot, the strip at the bottom.
No app chrome: no desk, no States panel, nothing with a token in it.

Its CSS is the `.paper` section of `print.css`, copied verbatim into
`apps/server/src/invoices/paper-css.ts`, with a preamble the server needs
and the renderer does not: an `@font-face` for IBM Plex Sans embedded as a
data URL (from `@fontsource-variable/ibm-plex-sans`, read at start), the
`--font-sans` stack, a body reset and the `@page` rule. `template.test.ts`
reads `print.css` from the repository and fails when the copy has drifted
from the section it was taken from, so the renderer's stylesheet stays the
one place the sheet is designed.

The dates. The renderer formats an instant to the machine's local calendar
day before printing it; the server has no machine to be local to, and
formats the UTC day. An invoice issued at 23:30 in San Francisco prints the
next day's date on the PDF. This is the honest choice for a document made
in one place for clients anywhere, and it is noted rather than hidden.

### Fetching it

`LedgerApi.pdf` — three named methods, each a thin handler over plain
functions in `apps/desktop/src/main/pdf/`:

```
pdf.generate(invoiceId) → Result<InvoicePdf>     { invoiceId, path, generatedAt, cached }
pdf.reveal(invoiceId)   → Result<null>           shell.showItemInFolder on the cached file
pdf.saveAs(invoiceId)   → Result<string | null>  the save dialog; the path chosen, or null
```

`generate`:

1. Runs a sync and waits for it. The server renders from its copy of the
   row, and the copy has to be current. A run that failed is answered with
   the matching code: `offline`, `unauthorized`, or `internal`.
2. Reads the invoice. If it is still `pending` after the sync — a rejected
   row, say — the answer is `invalid_state`: the PDF would not show what
   the screen shows.
3. If `<cache>/<invoiceId>.pdf` exists and its sidecar `<invoiceId>.json`
   records the invoice's current `updatedAt`, answers with the cached file.
4. Otherwise streams `GET /invoices/:id/pdf` to `<invoiceId>.pdf.part`,
   renames it into place, stamps the invoice with `markPdfGenerated(db, id,
   now)`, and writes the sidecar with the `updatedAt` that stamp produced —
   so the next click, on an untouched invoice, is a cache hit, and any edit
   or pull that moves the row is a re-render.

The cache is `app.getPath('userData')/invoice-pdfs`. The transport is
`fetch` with the bearer token and a 60 second timeout, folded into the same
error codes the auth and sync clients use.

### In the UI

The rail's "Download PDF" button calls `generate`. While the machine is
offline, or nobody is signed in, or the session has expired, the button is
disabled with the reason beneath it in the rail's aside register:

- "No connection. The PDF is made on the server."
- "Sign in to make a PDF."

On success the existing PDF toast appears with two live actions, "Show in
folder" and "Save as…". The toast's actions become real: `Toast.actions` is
a list of `{ label, onClick? }`, and the three older toasts keep their
labels with no handler, as they were.

### The States panel

- A **Connection** lever, `live | offline`, forces the offline reason on
  the PDF button whatever the machine's link says.
- A **Provisional draft** choice on the Screen row opens the seeded
  provisional draft: the fixtures mark INV-0149, the one draft, provisional.
- The Toast row's PDF choice now fires the toast with working actions
  against the sample invoice.

## Tests

- `template.test.ts` (root `npm test`): a snapshot of the HTML for a two-
  project invoice with tax, and the drift check against `print.css`.
- `invoices.integration.test.ts` (server, Postgres): the owner gets
  `application/pdf` beginning `%PDF`; another account gets 404; no token
  gets 401; minting is sequential under one scheme, idempotent per invoice,
  counts numbers already uploaded, and ignores provisional ones.
- Desktop unit tests: `createInvoice` with a supplied number and flag,
  `assignInvoiceNumber`, `markPdfGenerated`, the refusal of `number` on
  update; the engine's swap against a scripted transport; the PDF service's
  cache and sync-first rules against a fake fetch.
- `tests/sync`: scenario 6, both devices draft offline and take the same
  provisional number; after both sync the numbers differ, both ledgers are
  the same, and the swap is in the log.
