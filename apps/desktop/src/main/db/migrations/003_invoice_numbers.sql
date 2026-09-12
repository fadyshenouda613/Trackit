-- 003: server-issued invoice numbers, and when a PDF was last made.
--
-- number_provisional is set on a draft raised while the server could not
-- be reached: its number is the local scheme's guess, and the sync engine
-- replaces it with the server's on the first run that gets through. Every
-- invoice already on file was numbered locally under the old rule and is
-- kept as it is, not marked provisional: those numbers have been sent.
-- pdf_generated_at is stamped by the desktop each time it fetches a PDF.

ALTER TABLE invoices ADD COLUMN number_provisional INTEGER NOT NULL DEFAULT 0 CHECK (number_provisional IN (0, 1));
ALTER TABLE invoices ADD COLUMN pdf_generated_at TEXT;
