CREATE TABLE "kh_import" (
	"key" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kh_saved_search" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kh_expense" ADD COLUMN "import_key" uuid;--> statement-breakpoint
ALTER TABLE "kh_expense" ADD COLUMN "search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || merchant || ' ' || notes)) STORED;--> statement-breakpoint
ALTER TABLE "kh_import" ADD CONSTRAINT "kh_import_owner_id_kh_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_saved_search" ADD CONSTRAINT "kh_saved_search_owner_id_kh_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kh_import_owner_idx" ON "kh_import" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "kh_saved_search_owner_idx" ON "kh_saved_search" USING btree ("owner_id","position");--> statement-breakpoint
CREATE INDEX "kh_expense_search_idx" ON "kh_expense" USING gin ("search");