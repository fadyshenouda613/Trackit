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
