-- 002: what the sync engine keeps beside the ledger.
--
-- sync_meta holds the few facts the engine needs across launches: the
-- cursor the server last gave, the device id minted once per install, when
-- a sync last worked, and which account this database was first synced
-- under. sync_conflicts records local edits that lost to another device's,
-- with both versions as JSON, until the person has seen them. sync_events
-- is the popover's log. None of it travels to the server.

CREATE TABLE sync_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE sync_conflicts (
  id                TEXT PRIMARY KEY,
  table_name        TEXT NOT NULL,
  -- Empty for settings, which has no id.
  row_id            TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('record', 'reorder')),
  project_id        TEXT,
  label             TEXT NOT NULL,
  -- JSON arrays and objects: the differing fields, the losing local row, the winner.
  fields            TEXT NOT NULL,
  local             TEXT NOT NULL,
  remote            TEXT NOT NULL,
  local_deleted_at  TEXT,
  remote_deleted_at TEXT,
  detected_at       TEXT NOT NULL,
  resolved_at       TEXT,
  resolution        TEXT CHECK (resolution IN ('keepTheirs', 'restoreMine'))
);
CREATE INDEX sync_conflicts_open ON sync_conflicts (detected_at) WHERE resolved_at IS NULL;

CREATE TABLE sync_events (
  id     TEXT PRIMARY KEY,
  kind   TEXT NOT NULL CHECK (kind IN ('synced', 'failed', 'conflict')),
  at     TEXT NOT NULL,
  detail TEXT NOT NULL
);
CREATE INDEX sync_events_at ON sync_events (at);

-- A settings row nobody has touched has nothing to say. 001 inserted it
-- pending, which would have every fresh install upload its defaults — and
-- win, being newer, over the real settings another machine set earlier.
-- Untouched, it is synced and dated at the epoch, so whatever the account
-- already holds replaces it; the first edit makes it pending as before.
UPDATE settings
SET sync_state = 'synced', updated_at = '1970-01-01T00:00:00.000Z'
WHERE sync_state = 'pending'
  AND person = '' AND business_name = '' AND address = '' AND email = '' AND phone = ''
  AND logo IS NULL AND currency = 'USD' AND tax_rate = 0 AND payment_terms_days = 14
  AND numbering_scheme = 'INV-0000' AND rate_floor_cents = 0
  AND shortcut = 'CommandOrControl+Shift+S';
