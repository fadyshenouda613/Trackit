<h1 align="center">Trackit</h1>

<p align="center">
  <strong>Freelance time and billing for people who charge a fixed price.</strong><br>
  Track hours against fixed-price projects, see what you are <em>actually</em> earning an hour,
  turn delivered work into an invoice and follow the money until it lands.
</p>

<p align="center">
  <a href="https://github.com/fadyshenouda613/Trackit/actions/workflows/release.yml"><img alt="Build" src="https://github.com/fadyshenouda613/Trackit/actions/workflows/release.yml/badge.svg"></a>
  <a href="https://github.com/fadyshenouda613/Trackit/actions/workflows/ci.yml"><img alt="Tests" src="https://github.com/fadyshenouda613/Trackit/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/fadyshenouda613/Trackit/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/fadyshenouda613/Trackit?label=latest%20release"></a>
  <a href="https://github.com/fadyshenouda613/Trackit/releases/latest"><img alt="Downloads" src="https://img.shields.io/github/downloads/fadyshenouda613/Trackit/total?label=downloads"></a>
</p>

<p align="center">
  <img alt="Electron" src="https://img.shields.io/badge/Electron_44-2b2e3b?logo=electron&logoColor=9feaf9">
  <img alt="React" src="https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript_5.9-3178c6?logo=typescript&logoColor=white">
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-003b57?logo=sqlite&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express_5-000000?logo=express&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL_16-4169e1?logo=postgresql&logoColor=white">
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/dashboard-light.png">
    <img alt="The Trackit dashboard: unbilled, outstanding and paid this month, six active projects with their effective rates, and an Attention list" src="docs/screenshots/dashboard-dark.png">
  </picture>
</p>

<p align="center">
  <a href="#the-tour">Tour</a> ·
  <a href="#dark-and-light">Themes</a> ·
  <a href="#how-it-is-built">Architecture</a> ·
  <a href="#install">Install</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#project-structure">Structure</a>
</p>

---

## Why it exists

Fixed-price work hides its own margin. You agree $6,500 for a brand refresh,
the scope quietly grows, and you find out months later that you worked for $49
an hour. Trackit's whole job is to make that visible *while there is still time
to act*:

- Every project carries an **agreed price** and an **hours budget**.
- Every hour you log recalculates the **effective rate** — price ÷ hours.
- You set a **rate floor**. Anything below it is drawn in red, everywhere.
- Items added to a checklist **after kickoff** are counted, so scope creep is a
  number rather than a feeling.
- The dashboard's **Attention** list names the specific thing to do about it:
  renegotiate, re-scope, bill the added scope, chase the overdue invoice.

Everything is **local-first**. The app is fully usable with no account and no
network; an account adds a second copy of your ledger that other machines can
share, and nothing more.

---

## The tour

Every image below is a capture of the running app, not a mockup.

### Projects

![The projects table: twenty-one projects with price, status, checklist progress, hours against budget and effective rate against the floor](docs/screenshots/projects-dark.png)

Every project on one screen: price, status, checklist progress, hours against
budget, and the effective rate coloured against your floor. Two of the six
active projects are already under it.

![A project: price, checklist, hours, effective rate and budget up top; the checklist with four items tagged added later; client, dates, status history and the invoice in the sidebar](docs/screenshots/project-dark.png)

A project has a price, a deliverable checklist, an hours budget, notes and its
own time log. Items added after kickoff are tagged **added later**, so *"4 of
14 items were added after kickoff"* is a sentence you can take to a client.
Checklist items reorder by drag.

| Creating a project | Edited on two devices |
|---|---|
| ![The new project dialog: client, name, description, agreed price, hours budget and the implied rate against the floor](docs/screenshots/new-project-dark.png) | ![A project with a notice: the due date and price changed here and on another device; keep the other version or restore mine](docs/screenshots/conflict-dark.png) |
| The dialog shows the deal you are agreeing to *before* you agree to it: price ÷ estimated hours, checked against your floor. | The same project changed on two machines while one was offline. The later edit won; the losing machine is told, with its version one click away. |

### Time

![The Time screen with a timer running: the recording bar above the window shows the client, project, 28h 15m of 32h, 88% of budget and the elapsed clock; below it a week of entries grouped by day](docs/screenshots/time-running-dark.png)

A running timer lives in the window chrome above everything else, showing the
client, the project, elapsed time and how much of the budget it has eaten. The
week view groups entries by day with per-day and per-week totals, and compares
the week against the last one.

![The dashboard with an over-budget timer: the bar has turned red and reads 9h 05m of 6h, 3h 05m over](docs/screenshots/over-budget-dark.png)

**Over budget** turns the whole bar red and switches the readout from *"88% of
budget"* to *"3h 05m over"*.

![The recovery dialog: a timer for Brand refresh has been running for 13h 49m since yesterday at 4:10 PM; keep all of it, trim it to a time, or discard it](docs/screenshots/timer-recovery-dark.png)

**Crash recovery.** If the app quits with a timer running, the next launch asks
what to do with the orphaned run rather than silently keeping or dropping it.

### Clients

| Clients | A client's record |
|---|---|
| ![The clients table sorted by outstanding, with lifetime billed, active projects and how late each debt is](docs/screenshots/clients-dark.png) | ![A client: lifetime billed and outstanding, their projects, their invoices and free-text notes](docs/screenshots/client-detail-dark.png) |
| Sorted by outstanding, with lifetime billed, active project count and how late each debt is. | Their projects, their invoices, how fast they actually pay, and notes. |

### Invoicing

![The invoice register: outstanding total with the overdue share, then every invoice with issued and due dates, total, paid and status](docs/screenshots/invoices-dark.png)

The register: draft, sent, partially paid, paid, void and overdue, with search,
status and client filters, and an outstanding total that says how much of it is
overdue and on how many invoices.

![Building an invoice for Northwind Studio: two delivered projects ticked, a third shown but locked because it is already invoiced, the lines, and the totals with tax](docs/screenshots/new-invoice-dark.png)

**Building an invoice** starts from what is delivered and not yet billed. Tick
the projects; anything already on an invoice is shown but locked, so nothing
gets billed twice. Lines can be reworded, repriced and reordered.

| The invoice record | Recording a payment |
|---|---|
| ![An invoice: the document, its status and remaining balance, the actions available in that state, and the payment history below](docs/screenshots/invoice-dark.png) | ![The record payment dialog opened at the full outstanding amount, showing the balance after this payment as paid in full](docs/screenshots/record-payment-dark.png) |
| The document, its payment history, and the actions available given its state. | Opens at the full outstanding amount and tells you the balance after it lands before you commit. |

| Provisional number | Offline |
|---|---|
| ![A draft raised offline, its number marked Provisional until the draft has synced](docs/screenshots/provisional-draft-dark.png) | ![An invoice with no connection: Download PDF is disabled and says the PDF is made on the server](docs/screenshots/invoice-offline-dark.png) |
| **Invoice numbers are issued by the server**, so two machines can never mint the same one. A draft raised offline holds the number the local scheme guessed, marked *Provisional*, and takes the server's on the first sync through. | *Download PDF* asks the server for the sheet as a file. With no connection or no session the button is disabled and says why. |

![The printed invoice: the studio's details, bill to, the lines grouped by project, subtotal and total due, on a white sheet with none of the app's chrome](docs/screenshots/printed-invoice-dark.png)

**The printed artefact**, grouped by project with subtotals, tax and payment
terms. This is the thing the client receives, so it is rendered without any of
the app's chrome. The same template prints it in the app and on the server,
where a headless browser turns it into the PDF.

### Sync, notices and toasts

![The sync popover over the dashboard: Trackit did not answer, nothing was lost, five time entries, two projects and one invoice waiting to upload, and the recent activity including two conflicts](docs/screenshots/sync-failed-dark.png)

The sidebar footer carries four distinct sync states (*saved*, *syncing*,
*pending*, *failed*) because *"work is queued"* and *"the last attempt failed"*
are different situations that need different responses. Behind it, the popover
lists what is waiting and what happened recently.

| Account and sync | An update is ready |
|---|---|
| ![Settings, Account and sync: signed in as, last synced, pending changes, Sync now, session status and sign out](docs/screenshots/settings-account-dark.png) | ![A notice over the dashboard: Version 1.4 is ready, Trackit restarts to finish installing, a running timer is stopped and logged first](docs/screenshots/update-notice-dark.png) |

| A payment landed | A PDF was made |
|---|---|
| ![A toast: $2,400.00 recorded against INV-0145, with a View invoice link](docs/screenshots/toast-payment-dark.png) | ![A toast: Invoice INV-0145 saved as PDF, with Show in folder and Save as](docs/screenshots/toast-pdf-dark.png) |

Actions confirm themselves and stay actionable: the toast names the amount and
the invoice it landed on, and links straight to it.

### First run

| Sign in | Set up |
|---|---|
| ![The sign-in card: email, password, and a note that you only need an account the first time](docs/screenshots/sign-in-dark.png) | ![The welcome card: Trackit is set up, everything lives on this machine and works without a connection, add your first client](docs/screenshots/welcome-dark.png) |
| ![The empty dashboard: Start with a client, with the sidebar dimming everything that does not exist yet](docs/screenshots/empty-state-dark.png) | ![The no-connection card: first sign-in needs a connection, nothing is lost while you wait](docs/screenshots/offline-dark.png) |

You only need an account the first time; after that Trackit opens straight into
your work, online or not. A new account starts with one thing to do, and the
sidebar dims everything that does not exist yet.

### Settings

![Settings, Invoicing: default currency, tax rate, payment terms with the due date an invoice issued today would get, and the numbering scheme with a preview of the next number](docs/screenshots/settings-invoicing-dark.png)

Six panes: **Business profile** (what gets printed on every invoice),
**Invoicing** (currency, tax rate, payment terms, and a numbering scheme that
understands `{YYYY}`, `{YY}`, `{MM}` and a zero-run counter — `INV-0000` and
`INV-000000` differ only in width), **Tracking** (the rate floor and the global
timer shortcut), **Appearance**, **Account and sync**, and **Data**. There is no
Save button; changes apply as you make them.

---

## Dark and light

Trackit ships both themes as first-class designs — not a filter over one
palette. Every colour is an `oklch()` token in
[`apps/desktop/src/renderer/src/styles/tokens.css`](apps/desktop/src/renderer/src/styles/tokens.css); no
component file contains a raw colour. The light theme redefines the tokens, and
inverts the ones that have to go the other way (hover, for instance, steps
*down* in light and *up* in dark).

| Dark | Light |
|---|---|
| ![Dashboard, dark](docs/screenshots/dashboard-dark.png) | ![Dashboard, light](docs/screenshots/dashboard-light.png) |
| ![Project, dark](docs/screenshots/project-dark.png) | ![Project, light](docs/screenshots/project-light.png) |
| ![Invoices, dark](docs/screenshots/invoices-dark.png) | ![Invoices, light](docs/screenshots/invoices-light.png) |
| ![Invoice, dark](docs/screenshots/invoice-dark.png) | ![Invoice, light](docs/screenshots/invoice-light.png) |

Choose Light, Dark or System in **Settings → Appearance**:

| Dark | Light |
|---|---|
| ![Appearance settings, dark](docs/screenshots/settings-appearance-dark.png) | ![Appearance settings, light](docs/screenshots/settings-appearance-light.png) |

Three details make the switch feel native rather than bolted on:

1. **No flash of the wrong theme.** `apps/desktop/src/renderer/public/theme-boot.js` is a
   classic (non-module, non-deferred) script in `<head>` that stamps
   `data-theme` from `localStorage` before the first paint.
2. **The OS is followed live.** "System" is a standing instruction, not a third
   palette — a `matchMedia` listener repaints when the OS flips.
3. **The native window follows too.** The preference is sent to the main
   process over IPC and handed verbatim to Electron's `nativeTheme`, which
   tints macOS traffic lights and native menus. The window's own
   `backgroundColor` is repainted to match, so a resize never flashes a dark
   slab behind a light app.

---

## How it is built

Everything in this repository is real, running code, and all of it is
**local-first**. The app is fully usable with no account and no network; an
account adds a second copy of your ledger that other machines can share, and
nothing more.

```mermaid
flowchart LR
  subgraph desktop ["Electron app — one per machine"]
    direction TB
    renderer["Renderer<br/>React + TanStack Query<br/>no Node, no filesystem, no network"]
    preload["Preload bridge<br/>window.ledger, typed by packages/shared/api.ts"]
    main["Main process<br/>repositories · timer · sync engine · session · PDF cache"]
    sqlite[("SQLite<br/>trackit.db, or trackit-id.db per account")]
    renderer -- "named calls, Result values back" --> preload
    preload -- "IPC, input parsed with the shared schema" --> main
    main --> sqlite
  end
  subgraph server ["Server"]
    direction TB
    api["Express 5<br/>/auth · /sync · /invoices"]
    pg[("PostgreSQL<br/>the same tables + user_id, server_seq, updated_by")]
    chrome["Headless Chrome<br/>Puppeteer, prints the invoice"]
    api --> pg
    api --> chrome
  end
  main -- "POST /sync — pending rows + last cursor" --> api
  api -- "rows after the cursor, parents first, next cursor, rejects" --> main
  shared["packages/shared<br/>Zod schemas · money, date and rate helpers · the bridge contract"]
  shared -.-> renderer
  shared -.-> main
  shared -.-> api
```

**SQLite under the main process.** The ledger is a SQLite file in the app's
data directory, opened with better-sqlite3 by the main process and by nothing
else. Every read and write is a plain function that takes a `db` handle — no
`app`, no `BrowserWindow`, no `ipcMain` inside — so the entire data layer runs
under Vitest with no Electron in sight. Schema changes are numbered migrations
applied at launch; an old one is never edited, the next one is written.

**A typed IPC bridge.** The renderer never touches the database, the
filesystem or the network. It reaches the main process through one preload
bridge, `window.ledger`, whose whole contract is a TypeScript type in
[`packages/shared/src/api.ts`](packages/shared/src/api.ts): one named method
per operation a screen performs, each validated against the shared schema on
the far side, each answering `{ ok: true, data }` or `{ ok: false, error }`.
Nothing throws across the bridge, and there is no generic
`invoke(channel, payload)` — a passthrough is a bridge with no contract.
`contextIsolation` is on, `nodeIntegration` is off, and the CSP is strict. In
the renderer, TanStack Query is the cache in front of the bridge; screen,
dialog and theme stay in React state.

**One set of schemas across three runtimes.** Every entity — client, project,
checklist item, note, time entry, invoice, line, payment, settings — is
defined once, as a Zod schema in `packages/shared`, and every type in the
codebase is inferred from it. The renderer validates its forms with it, the
main process validates IPC input and rows with it, the server validates
request bodies and sync rows with it, so a field added in one place is a type
error everywhere it is missing. The primitives are shared too: **money is
integer cents**, never a float, formatted only at render; **timestamps are UTC
ISO 8601 strings**, turned into local time only at render; **ids are
client-generated UUIDv4s**, minted by whoever creates the row, so an offline
machine never waits for a server to name things; **deletes are soft**,
setting `deletedAt`, so a deletion is a row that can travel.

**Last-write-wins sync over a `serverSeq` cursor.** `POST /sync` is the whole
protocol. A machine sends the rows it has changed and the cursor it last
received; it gets back every row of the account's written after that cursor,
parent tables first, one page at a time, plus the rows the server turned away
and why. Every row the server writes takes the next value of one account-wide
sequence, `serverSeq`, so the cursor is a single integer that never goes
backwards and a pull can neither miss a row nor send one twice. The same row
changed on two machines is settled by the later `updatedAt`, ties broken by
device id — the same rule on the server and on every client, so every copy
converges on the same version — and the machine whose edit lost is shown a
notice with its version one click away. Tombstones sync like any other row,
which is what makes soft deletes and sync fit together: a second machine
receives the deletion rather than never hearing of the row again. A crash in
the middle of a sync loses nothing, because pushed rows stay pending until
the answer is applied, with the cursor, in one transaction. The design is in
[`docs/superpowers/specs/2026-09-10-sync-engine-design.md`](docs/superpowers/specs/2026-09-10-sync-engine-design.md);
the suite that runs two real engines against the real server is
[`tests/sync/`](tests/sync).

**Server-issued invoice numbers.** Two machines can never mint the same
number, because only the server counts. A draft raised online takes its
number at once; one raised offline holds the number the local scheme
guessed, marked *Provisional* wherever it appears, and swaps it for the
server's on the first sync through.

**Puppeteer PDFs.** The printed invoice is one HTML sheet, rendered by the
same template in the app and on the server. *Download PDF* asks the server
for that sheet as a file: it renders the row it holds with a headless
browser, so the desktop syncs first, and the bytes land in the machine's
cache with *Show in folder* and *Save as…* on the toast.

### How it was built

The interface came first, and all of it. Every screen, dialog, notice, empty
state, timer state and sync state was designed, implemented and reachable
before a single row was stored anywhere. Most of those states cannot be
reached by navigating — a failed sync, an orphaned timer, a void invoice, a
two-device conflict, an account that owns nothing yet — so the app grew a
**States** panel that forces any of them from the corner of the window, and
that panel became the specification. The data layer was then built to
produce those states rather than the other way round: the local database,
the bridge, the account server, the sync engine and the PDF route each
arrived as a branch whose bar was "the panel's states are now real
conditions, and the panel still reaches every one of them". The panel never
went away. It drives fixtures now instead of stand-ins, and it is still the
fastest way to review the app.

![The dashboard with the Data lever set to Loading: the figures are in, the project rows are skeletons](docs/screenshots/dashboard-loading-dark.png)

The order is deliberate. A surface finished before its data tends to say
what the data has to be — four sync states rather than three, a provisional
invoice number as a first-class marker, a timer that is a row rather than a
value in memory — and a backend built to a finished surface has nowhere to
leak into it.

---

## Install

Installers for every release are on the
[latest release](https://github.com/fadyshenouda613/Trackit/releases/latest)
page:

| Platform | File |
|---|---|
| Windows 10/11 (x64) | `Trackit-Setup-<version>.exe` — a one-click installer, per user, no admin prompt |
| macOS (Apple silicon) | `Trackit-<version>-arm64.dmg` |
| macOS (Intel) | `Trackit-<version>-x64.dmg` |

**The builds are not code-signed**, so each OS shows a warning the first
time. It is the same warning every unsigned app gets; here is how to get past
it.

**Windows.** SmartScreen shows *"Windows protected your PC"*. Click **More
info**, then **Run anyway**. The installer puts the app in
`%LOCALAPPDATA%\Programs\trackit` and adds a Start Menu entry; uninstall it
from *Settings → Apps* like anything else.

**macOS.** Open the DMG and drag Trackit into *Applications*. The first launch
is refused with *"Trackit cannot be opened because it is from an unidentified
developer"* (or *"…Apple could not verify…"* on macOS 15). Either:

- **Control-click** the app in *Applications* and choose **Open**, then **Open**
  again in the dialog — macOS remembers the choice; or
- on macOS 15 and later, try to open it once, then go to *System Settings →
  Privacy & Security*, scroll to the message about Trackit and click **Open
  Anyway**; or
- clear the quarantine flag from a terminal:
  `xattr -dr com.apple.quarantine /Applications/Trackit.app`.

**Where your data lives.** Everything is in SQLite files in the app's
per-user data directory — `%APPDATA%\Trackit` on Windows,
`~/Library/Application Support/Trackit` on macOS. Signed out, Trackit works
on `trackit.db`; each account that signs in gets its own `trackit-<id>.db`
beside it, so two people sharing a machine never see each other's ledger.
The first account to sign in takes over `trackit.db`, so nothing made before
signing up is left behind. Uninstalling leaves the files in place.

**Updates.** Trackit checks this repository's releases shortly after launch
and a few times a day. On Windows a newer build downloads in the background
and a notice offers a restart (a running timer is stopped and logged first).
On macOS an unsigned app cannot replace itself, so the notice links to the
download instead; drop the new app over the old one and your data stays
where it is.

---

## Desktop integration

**Frameless on every platform.** On macOS the traffic lights stay, inset into
the app's own chrome; on Windows and Linux the renderer draws its own controls
and talks to the main process over IPC.

**Menu-bar / tray timer.** The tray glyph is the app's recording dot — filled
while a timer runs, hollow while it does not — so the menu bar answers the
question without being opened. Its menu carries the current project, a live
elapsed clock, and Start/Stop. On macOS the elapsed time also sits beside the
icon. Both the tray glyph and the app icon are rasterized in code
(`apps/desktop/src/main/tray.ts`, `apps/desktop/src/main/icon.ts`) rather than shipped as build assets, so
they cannot drift out of sync with `Logo.tsx`.

**Global shortcut.** <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> +
<kbd>S</kbd> toggles the timer from anywhere. If the binding is already taken,
the app logs a warning rather than showing a hint that does nothing.

**Security.** `contextIsolation: true`, `nodeIntegration: false`, a strict CSP
in `index.html`, and a preload bridge on which every method is named in
[`packages/shared/src/api.ts`](packages/shared/src/api.ts) — window controls,
data, timer, sync, account, updates and PDF — with nothing generic beside
them. The refresh token never reaches the renderer. External links open in
the real browser, never in an app window.

---

## Getting started

**Requirements** — Node 20.19+ or 22.12+ (Vite 7's baseline; developed on
v24.13.0), and Docker for the server's Postgres.

The desktop app alone is two commands:

```bash
npm install      # installs every workspace
npm run dev      # electron-vite dev — launches the app with HMR
```

It opens on an empty ledger. To see it the way the screenshots do, load the
fixtures — fourteen projects, their clients, hours, invoices and payments,
with a history behind them:

```bash
npm run seed              # into the signed-out database; refuses to load over existing data
npm run seed -- --reset   # start that file over first
```

The same fixtures are one click away inside the app, on the **States**
panel's Data lever, which can also empty the database. The seed lands on
`trackit.db`, the file the app uses while signed out; the first account to
sign in on the machine adopts it, so seeded work carries into an account.

Signing in, syncing and *Download PDF* need the account server, which is a
Postgres in Docker and one more `dev`:

```bash
cd apps/server
docker compose up -d                 # Postgres 16 on port 5433, kept in a named volume
cp .env.example .env                 # then set JWT_SECRET (32+ characters)
npm run dev                          # tsx watch, http://localhost:4000 — migrates on start
```

The desktop dev build looks for the server at `http://127.0.0.1:4000`; point
it elsewhere with `TRACKIT_SERVER_URL`. Sign up in the app, and the ledger
starts syncing. Without the server the sign-in card says it could not reach
your account, and everything behind the front door still works — an account
is only ever for syncing.

The root scripts delegate to the desktop workspace, so everything below runs
from the repository root.

`npm run dev` also serves the renderer at <http://localhost:5173>. Opening that
URL in a browser works: `apps/desktop/src/renderer/src/bridge.ts` supplies a no-op stand-in
for the preload bridge, so everything but the native window controls behaves
normally.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server + Electron, with hot reload |
| `npm run build` | Build main, preload and renderer into `out/` |
| `npm start` | `electron-vite preview` — run the built app |
| `npm run typecheck` | Type-check every workspace |
| `npm run typecheck:node -w @trackit/desktop` | Main and preload only |
| `npm run typecheck:web -w @trackit/desktop` | Renderer only |
| `npm run package -w @trackit/desktop` | Build, then produce this platform's installer in `apps/desktop/dist/` |
| `npm test` | Every unit test in every workspace — the schemas, the helpers, the main process's plain functions |
| `npm run test:integration -w @trackit/server` | The auth, sync and invoice routes against the Docker Postgres |
| `npm run test:sync` | Two real engines against the real server (see [`tests/sync`](tests/sync)) |

### Accounts, the server and sync

`apps/server` is an Express 5 + PostgreSQL service (Drizzle ORM) that holds
accounts and the synced ledger. The desktop's sign-in and sign-up cards call
it, and so does the sync engine in the main process. An account is never
needed to read or write your work — an expired session only stops syncing.
How the sync itself works is under [How it is built](#how-it-is-built).

The engine runs at launch, every minute, when the network comes back, when
you sign in, and from **Sync now**. The sidebar footer is its status: *All
changes saved*, *Syncing*, *N waiting to upload*, or *Could not sync* with the
reason in the popover behind it.

Routes: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`,
`GET /auth/me`, `POST /sync`, `POST /invoices/:id/number`,
`GET /invoices/:id/pdf`, and `/health`. Passwords are argon2id hashes. An access token
is a 15-minute JWT; the refresh token that earns the next one is rotated on
every use, stored only as a hash, and revoking one revokes its whole family —
so a refresh token that turns up twice signs that session out everywhere.
Every failure is `{ "error": { "code", "message" } }`, never a stack trace.

The desktop keeps the refresh token in `session.json` beside the database,
encrypted with the OS keychain (Electron's `safeStorage`). It refreshes in the
background on launch; a machine that cannot reach the server stays signed in,
and one the server refuses shows *Session expired* under **Settings →
Account** without touching the local data. Point a development build at
another server with `TRACKIT_SERVER_URL`; a packaged build reads
`MAIN_VITE_SERVER_URL` from `apps/desktop/.env` at build time. The default is
`http://127.0.0.1:4000`.

Schema changes are new files under `apps/server/drizzle/` from
`npm run db:generate -w @trackit/server`; the server applies them at start.
Deploy from `apps/server/Dockerfile` — `railway.json` and `render.yaml` at
the root are ready-made for Railway and Render, and `.env.example` lists
every variable. CI runs the integration tests against a Postgres service and
builds the image on every push.

### Packaging and releases

`npm run package` in the desktop workspace runs the build and then
[electron-builder](https://www.electron.build/) from
`apps/desktop/electron-builder.yml`: an NSIS installer on Windows, a DMG (plus
the zip the updater reads) on macOS. The app icon is not a checked-in asset —
`apps/desktop/tooling/icons.ts` draws the `.ico` and `.icns` from the same
geometry as the window icon (`src/main/mark.ts`) at the start of every build.
better-sqlite3 ships a Node-API prebuild, so nothing is rebuilt against
Electron; the package unpacks it beside the asar and `require` finds it there.

Releases are cut by tag. Pushing `vX.Y.Z` (matching the version in
`apps/desktop/package.json`) runs `.github/workflows/release.yml`, which builds
on a Windows and a macOS runner, attaches the installers and the
`latest*.yml` feed files to a draft GitHub Release, and publishes it once both
have uploaded. `.github/workflows/ci.yml` runs the type-checker and the tests
on every push and pull request.

In-app updates come from [electron-updater](https://www.electron.build/auto-update)
reading that same release feed (`apps/desktop/src/main/updates.ts`); the
renderer only ever sees a status value over the bridge.

### The States panel

Some states cannot be reached by navigating — the empty account, a failed
sync, an orphaned timer, a void invoice, a loading skeleton, a conflict from
a machine you do not have. A dev panel covers all of them, by seeding the
real database or forcing the real state machines rather than painting a
picture of them. Click **States** in the bottom-right corner of a development
build and you get nine axes:

| Axis | Options |
|---|---|
| Screen | 18, including every dialog, a draft with a provisional number and the printed invoice |
| Account | In, Sign in, Sign up, Welcome, Offline |
| Timer | Stopped, Running, Over budget |
| Sync | Live, Saved, Syncing, Pending, Failed |
| Notice | None, Conflict, Reorder, Update, Download |
| Connection | Live, Offline *(disables Download PDF with its reason)* |
| Data | Ready, Loading |
| Toast | PDF, Payment, Delivered, Timer, Error *(fires rather than selects)* |
| Theme | Dark, Light, System |

It lives in [`apps/desktop/src/renderer/src/dev/StatePanel.tsx`](apps/desktop/src/renderer/src/dev/StatePanel.tsx)
and is the fastest way to see the whole app. It is also how every screenshot
in this README was taken: the running development build was driven over the
Chrome DevTools Protocol, one lever at a time, with the pointer parked.

---

## Project structure

The repository is an npm workspace: the desktop app and the server share
code through `packages/shared`.

```
apps/
├── desktop/                       @trackit/desktop — the Electron app
│   ├── electron.vite.config.ts
│   ├── tsconfig.node.json           main + preload
│   ├── tsconfig.web.json            renderer
│   └── src/
│       ├── main/                    Electron main process
│       │   ├── index.ts               App lifecycle, the account switch, tray timer state
│       │   ├── window.ts              Frameless BrowserWindow, per-theme background fill
│       │   ├── ipc.ts, *-ipc.ts       Thin handlers: parse with the shared schema, call, answer a Result
│       │   ├── db/                    better-sqlite3, numbered migrations, one file per account
│       │   ├── repositories/          The plain functions over the tables — the business rules
│       │   ├── timer.ts               The running clock, which is a time_entries row
│       │   ├── sync/                  The sync engine: outbox, apply, conflicts, number swap, transport
│       │   ├── auth/                  The session: refresh token via safeStorage, the HTTP client
│       │   ├── pdf/                   Asks the server for the invoice sheet, caches the file
│       │   ├── seed/                  The fixtures and `--seed`
│       │   ├── tray.ts                Tray icon, menu, global shortcut
│       │   └── icon.ts                App icon, rasterized from Logo.tsx's geometry
│       ├── preload/index.ts         contextBridge → window.ledger
│       └── renderer/
│           ├── index.html             CSP + pre-paint theme boot
│           ├── public/theme-boot.js   Stamps data-theme before the first paint
│           └── src/
│               ├── App.tsx            Screen routing and the state that crosses screens
│               ├── bridge.ts          The preload bridge, with a browser stand-in
│               ├── components/        62 components + 14 data/helper modules
│               ├── data/              TanStack Query in front of the bridge: keys, one hook file per entity
│               ├── dev/StatePanel.tsx
│               └── styles/
│                   ├── tokens.css     Ledgerline design system — the token layer
│                   └── app.css        Everything drawn from those tokens
└── server/                        @trackit/server — Express 5 + PostgreSQL
    ├── Dockerfile                   Built from the repository root
    ├── docker-compose.yml           Postgres 16 for development and the tests
    ├── drizzle/                     Numbered migrations, generated by drizzle-kit
    └── src/
        ├── index.ts                 Config, migrate, listen, graceful stop
        ├── app.ts                   The Express app: helmet, cors, routes, error handler
        ├── config.ts                Every environment variable, checked once
        ├── errors.ts                One error shape for every failure
        ├── db/schema.ts             The SQLite tables mirrored, plus user_id, server_seq, updated_by
        ├── auth/                    Argon2 accounts, JWT access, rotating refresh tokens
        ├── sync/                    POST /sync: the conflict rule and the paged pull
        └── invoices/                Number minting, and the sheet printed by Puppeteer
packages/
└── shared/                        @trackit/shared — what desktop and server agree on
    └── src/
        ├── api.ts                   The preload bridge contract
        ├── schemas/                 Every entity, once, as a Zod schema; the sync wire shapes
        └── helpers/                 Money, dates, durations, rates, invoice maths — pure, and tested
tests/
└── sync/                          Two devices, one server: the engine's acceptance suite
```

**Stack:** Electron 44, React 19, TypeScript 5.9, Vite 7 via electron-vite 5,
Zod 4 for schemas, npm workspaces; on the server, Express 5, Drizzle ORM over
PostgreSQL 16, argon2 and jose. No UI framework, no CSS-in-JS, no state
library — plain CSS against a token layer, and React state lifted only as far
as it needs to go.

**Type-checking is split** the way the processes are: in `apps/desktop`,
`tsconfig.node.json` covers main and preload and `tsconfig.web.json` covers
the renderer, so neither can accidentally import the other's globals.
`packages/shared` and `apps/server` each have their own; `npm run typecheck`
at the root runs all of them.

`@trackit/shared` ships TypeScript source rather than a build, so the desktop
app bundles it into main and preload (see the `externalizeDepsPlugin` note in
`electron.vite.config.ts`) instead of leaving it as a runtime `require()`.

---

## Design notes

The design system is called **Ledgerline**. A few of its rules explain most of
what you see:

- **Cool-neutral greys, one accent, three semantics.** The accent is never
  decorative — it means a running timer, the primary action, or the one
  selected row.
- **Money is the loudest thing on screen.** Figures are set large, in a
  tabular-figure face, and coloured only when the colour carries meaning
  (below your floor, overdue, over budget).
- **State is a condition, not a place.** A notice, a timer, a sync failure and a
  dialog are all conditions of a screen rather than screens of their own — which
  is why the States panel has separate axes for them.
- **Every empty state names the next action.** No blank canvases.

The codebase is heavily commented, and the comments explain *why* rather than
*what* — why the theme is read synchronously instead of in an effect, why sync
has four states instead of three, why settings hold typed text instead of
numbers. They are worth reading if you are picking the project up.

---

## Troubleshooting

**`electron-vite dev` fails with an Electron "uninstall" error** even though
`npm install` looked clean — npm's postinstall can silently skip fetching the
Electron binary. Fix it with:

```bash
node node_modules/electron/install.js
```

---

## Screenshots

All images in this README live in [`docs/screenshots/`](docs/screenshots).
They were captured from the running development build, seeded with the
fixtures, at a 1440×900 window and 2× device pixel ratio, by driving the
States panel over the Chrome DevTools Protocol.
