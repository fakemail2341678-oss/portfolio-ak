CREATE TABLE "expense_budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"category_id" uuid NOT NULL,
	"month" date NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_budget_month_unique" UNIQUE("category_id","month","currency"),
	CONSTRAINT "expense_budget_amount_positive" CHECK ("expense_budget"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "expense_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_import" (
	"key" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"category_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"occurred_on" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"import_key" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_transaction_amount_positive" CHECK ("expense_transaction"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "habit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"days" smallint DEFAULT 127 NOT NULL,
	"target" smallint DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habit_days_valid" CHECK ("habit"."days" between 1 and 127),
	CONSTRAINT "habit_target_valid" CHECK ("habit"."target" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "habit_checkin" (
	"habit_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"day" date NOT NULL,
	"count" smallint NOT NULL,
	CONSTRAINT "habit_checkin_habit_id_day_pk" PRIMARY KEY("habit_id","day"),
	CONSTRAINT "habit_checkin_count_positive" CHECK ("habit_checkin"."count" > 0)
);
--> statement-breakpoint
ALTER TABLE "expense_budget" ADD CONSTRAINT "expense_budget_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_budget" ADD CONSTRAINT "expense_budget_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_import" ADD CONSTRAINT "expense_import_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_transaction" ADD CONSTRAINT "expense_transaction_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_transaction" ADD CONSTRAINT "expense_transaction_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit" ADD CONSTRAINT "habit_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_checkin" ADD CONSTRAINT "habit_checkin_habit_id_habit_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_checkin" ADD CONSTRAINT "habit_checkin_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_budget_owner_idx" ON "expense_budget" USING btree ("owner_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_category_name_unique" ON "expense_category" USING btree ("owner_id",lower("name"));--> statement-breakpoint
CREATE INDEX "expense_transaction_owner_idx" ON "expense_transaction" USING btree ("owner_id","occurred_on");--> statement-breakpoint
CREATE INDEX "habit_owner_idx" ON "habit" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "habit_checkin_owner_idx" ON "habit_checkin" USING btree ("owner_id","day");