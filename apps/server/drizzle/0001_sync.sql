-- 0001: one sequence for sync, and who wrote each row.
--
-- server_seq was a BIGSERIAL per table: ten sequences, which no single
-- cursor can page across. Every table's server_seq now draws from sync_seq,
-- started past anything already handed out, and the per-table sequences go.
-- updated_by records the device whose write a row's version is; ties on
-- updated_at are broken by comparing it.
CREATE SEQUENCE "public"."sync_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
SELECT setval('sync_seq', GREATEST(1, (SELECT COALESCE(MAX(server_seq), 0) FROM "checklist_items"), (SELECT COALESCE(MAX(server_seq), 0) FROM "clients"), (SELECT COALESCE(MAX(server_seq), 0) FROM "invoice_lines"), (SELECT COALESCE(MAX(server_seq), 0) FROM "invoices"), (SELECT COALESCE(MAX(server_seq), 0) FROM "milestones"), (SELECT COALESCE(MAX(server_seq), 0) FROM "notes"), (SELECT COALESCE(MAX(server_seq), 0) FROM "payments"), (SELECT COALESCE(MAX(server_seq), 0) FROM "projects"), (SELECT COALESCE(MAX(server_seq), 0) FROM "settings"), (SELECT COALESCE(MAX(server_seq), 0) FROM "time_entries")));--> statement-breakpoint
ALTER TABLE "checklist_items" ALTER COLUMN "server_seq" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "checklist_items" ALTER COLUMN "server_seq" SET DEFAULT nextval('sync_seq');--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "server_seq" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "server_seq" SET DEFAULT nextval('sync_seq');--> statement-breakpoint
ALTER TABLE "invoice_lines" ALTER COLUMN "server_seq" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "invoice_lines" ALTER COLUMN "server_seq" SET DEFAULT nextval('sync_seq');--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "server_seq" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "server_seq" SET DEFAULT nextval('sync_seq');--> statement-breakpoint
ALTER TABLE "milestones" ALTER COLUMN "server_seq" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "milestones" ALTER COLUMN "server_seq" SET DEFAULT nextval('sync_seq');--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "server_seq" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "server_seq" SET DEFAULT nextval('sync_seq');--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "server_seq" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "server_seq" SET DEFAULT nextval('sync_seq');--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "server_seq" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "server_seq" SET DEFAULT nextval('sync_seq');--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "server_seq" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "server_seq" SET DEFAULT nextval('sync_seq');--> statement-breakpoint
ALTER TABLE "time_entries" ALTER COLUMN "server_seq" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "time_entries" ALTER COLUMN "server_seq" SET DEFAULT nextval('sync_seq');--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "checklist_items_server_seq_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "clients_server_seq_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "invoice_lines_server_seq_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "invoices_server_seq_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "milestones_server_seq_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "notes_server_seq_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payments_server_seq_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "projects_server_seq_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "settings_server_seq_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "time_entries_server_seq_seq";
