-- 0002: server-issued invoice numbers, and when a PDF was last made.
--
-- invoice_numbers is the server's own ledger of the numbers it has handed
-- out, one per invoice, reserved the moment they are issued and unique per
-- account — see src/invoices/numbers.ts. The two invoice columns mirror
-- the desktop's migration 003.
CREATE TABLE "invoice_numbers" (
	"invoice_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"number" text NOT NULL,
	"reserved_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "number_provisional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "pdf_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_numbers" ADD CONSTRAINT "invoice_numbers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_numbers_user_number" ON "invoice_numbers" USING btree ("user_id","number");