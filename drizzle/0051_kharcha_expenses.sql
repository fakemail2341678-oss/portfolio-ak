CREATE TABLE "kh_share_tag" (
	"expense_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "kh_share_tag_expense_id_person_id_tag_id_pk" PRIMARY KEY("expense_id","person_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "kh_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"key" text,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kh_merchant_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"match" text DEFAULT 'contains' NOT NULL,
	"pattern" text NOT NULL,
	"category_id" uuid,
	"tag_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"method_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_merchant_rule_match_valid" CHECK ("kh_merchant_rule"."match" in ('contains', 'equals'))
);
--> statement-breakpoint
CREATE TABLE "kh_method" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kh_receipt_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kh_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kh_expense_payer" ADD COLUMN "method_id" uuid;--> statement-breakpoint
ALTER TABLE "kh_expense_share" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "kh_expense_share" ADD COLUMN "duplicate_ok" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kh_profile" ADD COLUMN "lists_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kh_share_tag" ADD CONSTRAINT "kh_share_tag_expense_id_kh_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."kh_expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_share_tag" ADD CONSTRAINT "kh_share_tag_person_id_kh_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."kh_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_share_tag" ADD CONSTRAINT "kh_share_tag_tag_id_kh_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."kh_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_category" ADD CONSTRAINT "kh_category_owner_id_kh_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_merchant_rule" ADD CONSTRAINT "kh_merchant_rule_owner_id_kh_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_merchant_rule" ADD CONSTRAINT "kh_merchant_rule_category_id_kh_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."kh_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_merchant_rule" ADD CONSTRAINT "kh_merchant_rule_method_id_kh_method_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."kh_method"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_method" ADD CONSTRAINT "kh_method_owner_id_kh_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_receipt_draft" ADD CONSTRAINT "kh_receipt_draft_owner_id_kh_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_tag" ADD CONSTRAINT "kh_tag_owner_id_kh_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kh_share_tag_tag_idx" ON "kh_share_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "kh_share_tag_person_idx" ON "kh_share_tag" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kh_category_name_unique" ON "kh_category" USING btree ("owner_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "kh_category_key_unique" ON "kh_category" USING btree ("owner_id","key") WHERE "kh_category"."key" is not null;--> statement-breakpoint
CREATE INDEX "kh_category_owner_idx" ON "kh_category" USING btree ("owner_id","position");--> statement-breakpoint
CREATE INDEX "kh_merchant_rule_owner_idx" ON "kh_merchant_rule" USING btree ("owner_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "kh_method_name_unique" ON "kh_method" USING btree ("owner_id",lower("name"));--> statement-breakpoint
CREATE INDEX "kh_method_owner_idx" ON "kh_method" USING btree ("owner_id","position");--> statement-breakpoint
CREATE INDEX "kh_receipt_draft_owner_idx" ON "kh_receipt_draft" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kh_tag_name_unique" ON "kh_tag" USING btree ("owner_id",lower("name"));--> statement-breakpoint
ALTER TABLE "kh_expense_payer" ADD CONSTRAINT "kh_expense_payer_method_id_kh_method_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."kh_method"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_expense_share" ADD CONSTRAINT "kh_expense_share_category_id_kh_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."kh_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kh_expense_share_category_idx" ON "kh_expense_share" USING btree ("category_id");