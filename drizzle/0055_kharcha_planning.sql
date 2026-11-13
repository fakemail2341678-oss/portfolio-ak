CREATE TABLE "kh_budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"category_id" uuid,
	"currency" text NOT NULL,
	"period" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"starts_on" date NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_budget_amount_positive" CHECK ("kh_budget"."amount_minor" > 0),
	CONSTRAINT "kh_budget_period_valid" CHECK ("kh_budget"."period" in ('week', 'month', 'year')),
	CONSTRAINT "kh_budget_currency_code" CHECK ("kh_budget"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "kh_budget_alert" (
	"budget_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"threshold" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_budget_alert_budget_id_period_start_threshold_pk" PRIMARY KEY("budget_id","period_start","threshold"),
	CONSTRAINT "kh_budget_alert_threshold_valid" CHECK ("kh_budget_alert"."threshold" in (80, 100))
);
--> statement-breakpoint
CREATE TABLE "kh_budget_month" (
	"budget_id" uuid NOT NULL,
	"month" date NOT NULL,
	"amount_minor" bigint NOT NULL,
	CONSTRAINT "kh_budget_month_budget_id_month_pk" PRIMARY KEY("budget_id","month"),
	CONSTRAINT "kh_budget_month_amount_positive" CHECK ("kh_budget_month"."amount_minor" > 0),
	CONSTRAINT "kh_budget_month_first_day" CHECK (extract(day from "kh_budget_month"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "kh_recurring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"group_id" uuid,
	"template" jsonb NOT NULL,
	"unit" text NOT NULL,
	"every" integer DEFAULT 1 NOT NULL,
	"starts_on" date NOT NULL,
	"next_n" integer NOT NULL,
	"next_on" date NOT NULL,
	"seq" integer DEFAULT 1 NOT NULL,
	"ends_on" date,
	"paused_at" timestamp with time zone,
	"problem" text,
	"last_made_on" date,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_recurring_unit_valid" CHECK ("kh_recurring"."unit" in ('week', 'month', 'year')),
	CONSTRAINT "kh_recurring_every_range" CHECK ("kh_recurring"."every" between 1 and 52)
);
--> statement-breakpoint
ALTER TABLE "kh_expense" ADD COLUMN "recurring_id" uuid;--> statement-breakpoint
ALTER TABLE "kh_expense" ADD COLUMN "recurring_n" integer;--> statement-breakpoint
ALTER TABLE "kh_budget" ADD CONSTRAINT "kh_budget_owner_id_kh_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_budget" ADD CONSTRAINT "kh_budget_category_id_kh_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."kh_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_budget_alert" ADD CONSTRAINT "kh_budget_alert_budget_id_kh_budget_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."kh_budget"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_budget_month" ADD CONSTRAINT "kh_budget_month_budget_id_kh_budget_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."kh_budget"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_recurring" ADD CONSTRAINT "kh_recurring_owner_id_kh_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_recurring" ADD CONSTRAINT "kh_recurring_group_id_kh_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."kh_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kh_budget_unique" ON "kh_budget" USING btree ("owner_id",coalesce("category_id", '00000000-0000-0000-0000-000000000000'::uuid),"currency","period");--> statement-breakpoint
CREATE INDEX "kh_budget_category_idx" ON "kh_budget" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "kh_recurring_owner_idx" ON "kh_recurring" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "kh_recurring_group_idx" ON "kh_recurring" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "kh_recurring_due_idx" ON "kh_recurring" USING btree ("next_on") WHERE "kh_recurring"."paused_at" is null;--> statement-breakpoint
ALTER TABLE "kh_expense" ADD CONSTRAINT "kh_expense_recurring_id_kh_recurring_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."kh_recurring"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kh_expense_recurring_unique" ON "kh_expense" USING btree ("recurring_id","recurring_n") WHERE "kh_expense"."recurring_id" is not null;