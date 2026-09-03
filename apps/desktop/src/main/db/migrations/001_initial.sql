-- 001: every table, from the shared schemas.
--
-- Column names are the schema fields in snake_case. Money is integer cents,
-- timestamps are UTC ISO 8601 text, booleans are 0/1, ids are the UUIDs the
-- client minted. Every syncable row carries the four base columns and its
-- sync state. Nothing is ever deleted: deleted_at is set, and every index on
-- a foreign key is partial on deleted_at IS NULL because that is the only
-- kind of row a query joins to.

CREATE TABLE clients (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  company            TEXT NOT NULL DEFAULT '',
  email              TEXT NOT NULL DEFAULT '',
  phone              TEXT NOT NULL DEFAULT '',
  address            TEXT NOT NULL DEFAULT '',
  currency           TEXT NOT NULL,
  payment_terms_days INTEGER NOT NULL DEFAULT 0,
  notes              TEXT NOT NULL DEFAULT '',
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  deleted_at         TEXT,
  sync_state         TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'synced'))
);
CREATE INDEX clients_updated_at ON clients (updated_at);

CREATE TABLE projects (
  id             TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL REFERENCES clients (id),
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  price_cents    INTEGER NOT NULL,
  currency       TEXT NOT NULL,
  budgeted_hours REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL,
  kickoff_at     TEXT,
  due_at         TEXT,
  delivered_at   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT,
  sync_state     TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'synced'))
);
CREATE INDEX projects_client_id ON projects (client_id) WHERE deleted_at IS NULL;
CREATE INDEX projects_status ON projects (status) WHERE deleted_at IS NULL;
CREATE INDEX projects_updated_at ON projects (updated_at);

CREATE TABLE milestones (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects (id),
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER,
  due_at       TEXT,
  delivered_at TEXT,
  sort_order   REAL NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  sync_state   TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'synced'))
);
CREATE INDEX milestones_project_id ON milestones (project_id) WHERE deleted_at IS NULL;
CREATE INDEX milestones_updated_at ON milestones (updated_at);

CREATE TABLE checklist_items (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects (id),
  label               TEXT NOT NULL,
  done                INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  added_after_kickoff INTEGER NOT NULL DEFAULT 0 CHECK (added_after_kickoff IN (0, 1)),
  sort_order          REAL NOT NULL,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT,
  sync_state          TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'synced'))
);
CREATE INDEX checklist_items_project_id ON checklist_items (project_id) WHERE deleted_at IS NULL;
CREATE INDEX checklist_items_updated_at ON checklist_items (updated_at);

CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects (id),
  client_id  TEXT REFERENCES clients (id),
  body       TEXT NOT NULL,
  pinned     INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'synced')),
  -- A note belongs to exactly one thing.
  CHECK ((project_id IS NULL) <> (client_id IS NULL))
);
CREATE INDEX notes_project_id ON notes (project_id) WHERE deleted_at IS NULL;
CREATE INDEX notes_client_id ON notes (client_id) WHERE deleted_at IS NULL;
CREATE INDEX notes_updated_at ON notes (updated_at);

CREATE TABLE time_entries (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects (id),
  checklist_item_id TEXT REFERENCES checklist_items (id),
  note              TEXT NOT NULL DEFAULT '',
  started_at        TEXT NOT NULL,
  -- NULL while the timer runs.
  ended_at          TEXT,
  source            TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  deleted_at        TEXT,
  sync_state        TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'synced'))
);
CREATE INDEX time_entries_project_id ON time_entries (project_id) WHERE deleted_at IS NULL;
CREATE INDEX time_entries_checklist_item_id ON time_entries (checklist_item_id) WHERE deleted_at IS NULL;
CREATE INDEX time_entries_started_at ON time_entries (started_at) WHERE deleted_at IS NULL;
CREATE INDEX time_entries_updated_at ON time_entries (updated_at);

CREATE TABLE invoices (
  id                     TEXT PRIMARY KEY,
  client_id              TEXT NOT NULL REFERENCES clients (id),
  number                 TEXT NOT NULL,
  status                 TEXT NOT NULL,
  currency               TEXT NOT NULL,
  issued_at              TEXT,
  due_at                 TEXT,
  tax_rate               REAL NOT NULL DEFAULT 0,
  subtotal_cents         INTEGER NOT NULL DEFAULT 0,
  tax_cents              INTEGER NOT NULL DEFAULT 0,
  total_cents            INTEGER NOT NULL DEFAULT 0,
  notes                  TEXT NOT NULL DEFAULT '',
  voided_at              TEXT,
  void_reason            TEXT,
  replaced_by_invoice_id TEXT REFERENCES invoices (id),
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  deleted_at             TEXT,
  sync_state             TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'synced'))
);
CREATE INDEX invoices_client_id ON invoices (client_id) WHERE deleted_at IS NULL;
CREATE INDEX invoices_status ON invoices (status) WHERE deleted_at IS NULL;
CREATE INDEX invoices_replaced_by_invoice_id ON invoices (replaced_by_invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX invoices_updated_at ON invoices (updated_at);

CREATE TABLE invoice_lines (
  id           TEXT PRIMARY KEY,
  invoice_id   TEXT NOT NULL REFERENCES invoices (id),
  project_id   TEXT REFERENCES projects (id),
  milestone_id TEXT REFERENCES milestones (id),
  label        TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  sort_order   REAL NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  sync_state   TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'synced'))
);
CREATE INDEX invoice_lines_invoice_id ON invoice_lines (invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX invoice_lines_project_id ON invoice_lines (project_id) WHERE deleted_at IS NULL;
CREATE INDEX invoice_lines_milestone_id ON invoice_lines (milestone_id) WHERE deleted_at IS NULL;
CREATE INDEX invoice_lines_updated_at ON invoice_lines (updated_at);

CREATE TABLE payments (
  id           TEXT PRIMARY KEY,
  invoice_id   TEXT NOT NULL REFERENCES invoices (id),
  paid_at      TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  method       TEXT NOT NULL,
  note         TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  sync_state   TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'synced'))
);
CREATE INDEX payments_invoice_id ON payments (invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX payments_updated_at ON payments (updated_at);

-- One row, never deleted. The CHECK keeps it one.
CREATE TABLE settings (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  person             TEXT NOT NULL DEFAULT '',
  business_name      TEXT NOT NULL DEFAULT '',
  address            TEXT NOT NULL DEFAULT '',
  email              TEXT NOT NULL DEFAULT '',
  phone              TEXT NOT NULL DEFAULT '',
  logo               TEXT,
  currency           TEXT NOT NULL DEFAULT 'USD',
  tax_rate           REAL NOT NULL DEFAULT 0,
  payment_terms_days INTEGER NOT NULL DEFAULT 14,
  numbering_scheme   TEXT NOT NULL DEFAULT 'INV-0000',
  rate_floor_cents   INTEGER NOT NULL DEFAULT 0,
  shortcut           TEXT NOT NULL DEFAULT 'CommandOrControl+Shift+S',
  theme              TEXT NOT NULL DEFAULT 'system',
  account_email      TEXT NOT NULL DEFAULT '',
  updated_at         TEXT NOT NULL,
  sync_state         TEXT NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending', 'synced'))
);
INSERT INTO settings (id, updated_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
