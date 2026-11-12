CREATE TABLE "kh_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"person_lo" uuid,
	"person_hi" uuid,
	"expense_id" uuid,
	"payment_id" uuid,
	"actor_id" uuid,
	"subject_id" uuid,
	"kind" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_activity_pair_ordered" CHECK (("kh_activity"."person_lo" is null and "kh_activity"."person_hi" is null) or "kh_activity"."person_lo" < "kh_activity"."person_hi")
);
--> statement-breakpoint
CREATE TABLE "kh_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"created_by" uuid NOT NULL,
	"kind" text DEFAULT 'expense' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"merchant" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"spent_on" date NOT NULL,
	"split" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_expense_amount_positive" CHECK ("kh_expense"."amount_minor" > 0),
	CONSTRAINT "kh_expense_kind_valid" CHECK ("kh_expense"."kind" in ('expense', 'refund')),
	CONSTRAINT "kh_expense_currency_code" CHECK ("kh_expense"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "kh_expense_payer" (
	"expense_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "kh_expense_payer_expense_id_person_id_pk" PRIMARY KEY("expense_id","person_id"),
	CONSTRAINT "kh_expense_payer_amount_positive" CHECK ("kh_expense_payer"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "kh_expense_share" (
	"expense_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"owed_minor" bigint NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "kh_expense_share_expense_id_person_id_pk" PRIMARY KEY("expense_id","person_id"),
	CONSTRAINT "kh_expense_share_owed_not_negative" CHECK ("kh_expense_share"."owed_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "kh_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"currency" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"start_on" date,
	"end_on" date,
	"created_by" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_group_kind_valid" CHECK ("kh_group"."kind" in ('trip', 'home', 'couple', 'event', 'other')),
	CONSTRAINT "kh_group_dates_ordered" CHECK ("kh_group"."start_on" is null or "kh_group"."end_on" is null or "kh_group"."start_on" <= "kh_group"."end_on")
);
--> statement-breakpoint
CREATE TABLE "kh_group_member" (
	"group_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "kh_group_member_group_id_person_id_pk" PRIMARY KEY("group_id","person_id"),
	CONSTRAINT "kh_group_member_role_valid" CHECK ("kh_group_member"."role" in ('owner', 'member'))
);
--> statement-breakpoint
CREATE TABLE "kh_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid,
	"payment_id" uuid,
	"group_id" uuid,
	"debtor_id" uuid NOT NULL,
	"creditor_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	CONSTRAINT "kh_ledger_one_source" CHECK (("kh_ledger"."expense_id" is null) <> ("kh_ledger"."payment_id" is null)),
	CONSTRAINT "kh_ledger_two_people" CHECK ("kh_ledger"."debtor_id" <> "kh_ledger"."creditor_id"),
	CONSTRAINT "kh_ledger_amount_positive" CHECK ("kh_ledger"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "kh_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"from_person" uuid NOT NULL,
	"to_person" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"paid_currency" text,
	"paid_amount_minor" bigint,
	"rate" numeric(18, 8),
	"method" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"paid_on" date NOT NULL,
	"created_by" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_payment_amount_positive" CHECK ("kh_payment"."amount_minor" > 0),
	CONSTRAINT "kh_payment_two_people" CHECK ("kh_payment"."from_person" <> "kh_payment"."to_person"),
	CONSTRAINT "kh_payment_currency_code" CHECK ("kh_payment"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "kh_payment_paid_together" CHECK (("kh_payment"."paid_currency" is null) = ("kh_payment"."paid_amount_minor" is null) and ("kh_payment"."paid_currency" is null) = ("kh_payment"."rate" is null))
);
--> statement-breakpoint
CREATE TABLE "kh_friend" (
	"owner_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"nickname" text DEFAULT '' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_friend_owner_id_friend_id_pk" PRIMARY KEY("owner_id","friend_id"),
	CONSTRAINT "kh_friend_not_self" CHECK ("kh_friend"."owner_id" <> "kh_friend"."friend_id")
);
--> statement-breakpoint
CREATE TABLE "kh_person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"email" text,
	"display_name" text NOT NULL,
	"color" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_person_email_lower" CHECK ("kh_person"."email" = lower("kh_person"."email"))
);
--> statement-breakpoint
CREATE TABLE "kh_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"home_currency" text DEFAULT 'NPR' NOT NULL,
	"time_zone" text DEFAULT 'Asia/Kathmandu' NOT NULL,
	"locale" text,
	"default_split" text DEFAULT 'equal' NOT NULL,
	"notify" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"focus" boolean DEFAULT false NOT NULL,
	"onboarded_at" timestamp with time zone,
	"pay_note" text DEFAULT '' NOT NULL,
	"invites_blocked_at" timestamp with time zone,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kh_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_settings_one_row" CHECK ("kh_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "kh_activity" ADD CONSTRAINT "kh_activity_group_id_kh_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."kh_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_activity" ADD CONSTRAINT "kh_activity_person_lo_kh_person_id_fk" FOREIGN KEY ("person_lo") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_activity" ADD CONSTRAINT "kh_activity_person_hi_kh_person_id_fk" FOREIGN KEY ("person_hi") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_activity" ADD CONSTRAINT "kh_activity_expense_id_kh_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."kh_expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_activity" ADD CONSTRAINT "kh_activity_payment_id_kh_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."kh_payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_activity" ADD CONSTRAINT "kh_activity_actor_id_kh_person_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."kh_person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_activity" ADD CONSTRAINT "kh_activity_subject_id_kh_person_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."kh_person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_expense" ADD CONSTRAINT "kh_expense_group_id_kh_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."kh_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_expense" ADD CONSTRAINT "kh_expense_created_by_kh_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."kh_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_expense_payer" ADD CONSTRAINT "kh_expense_payer_expense_id_kh_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."kh_expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_expense_payer" ADD CONSTRAINT "kh_expense_payer_person_id_kh_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."kh_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_expense_share" ADD CONSTRAINT "kh_expense_share_expense_id_kh_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."kh_expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_expense_share" ADD CONSTRAINT "kh_expense_share_person_id_kh_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."kh_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_group" ADD CONSTRAINT "kh_group_created_by_kh_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."kh_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_group_member" ADD CONSTRAINT "kh_group_member_group_id_kh_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."kh_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_group_member" ADD CONSTRAINT "kh_group_member_person_id_kh_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."kh_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_ledger" ADD CONSTRAINT "kh_ledger_expense_id_kh_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."kh_expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_ledger" ADD CONSTRAINT "kh_ledger_payment_id_kh_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."kh_payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_ledger" ADD CONSTRAINT "kh_ledger_group_id_kh_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."kh_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_ledger" ADD CONSTRAINT "kh_ledger_debtor_id_kh_person_id_fk" FOREIGN KEY ("debtor_id") REFERENCES "public"."kh_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_ledger" ADD CONSTRAINT "kh_ledger_creditor_id_kh_person_id_fk" FOREIGN KEY ("creditor_id") REFERENCES "public"."kh_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_payment" ADD CONSTRAINT "kh_payment_group_id_kh_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."kh_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_payment" ADD CONSTRAINT "kh_payment_from_person_kh_person_id_fk" FOREIGN KEY ("from_person") REFERENCES "public"."kh_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_payment" ADD CONSTRAINT "kh_payment_to_person_kh_person_id_fk" FOREIGN KEY ("to_person") REFERENCES "public"."kh_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_payment" ADD CONSTRAINT "kh_payment_created_by_kh_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."kh_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_friend" ADD CONSTRAINT "kh_friend_owner_id_kh_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_friend" ADD CONSTRAINT "kh_friend_friend_id_kh_person_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_person" ADD CONSTRAINT "kh_person_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_person" ADD CONSTRAINT "kh_person_created_by_kh_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."kh_person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_profile" ADD CONSTRAINT "kh_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_profile" ADD CONSTRAINT "kh_profile_person_id_kh_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kh_activity_group_idx" ON "kh_activity" USING btree ("group_id","at");--> statement-breakpoint
CREATE INDEX "kh_activity_pair_idx" ON "kh_activity" USING btree ("person_lo","person_hi","at");--> statement-breakpoint
CREATE INDEX "kh_activity_expense_idx" ON "kh_activity" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "kh_activity_payment_idx" ON "kh_activity" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "kh_activity_actor_idx" ON "kh_activity" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "kh_activity_subject_idx" ON "kh_activity" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "kh_expense_group_idx" ON "kh_expense" USING btree ("group_id","spent_on");--> statement-breakpoint
CREATE INDEX "kh_expense_created_by_idx" ON "kh_expense" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "kh_expense_trash_idx" ON "kh_expense" USING btree ("deleted_at") WHERE "kh_expense"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "kh_expense_payer_person_idx" ON "kh_expense_payer" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "kh_expense_share_person_idx" ON "kh_expense_share" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "kh_group_created_by_idx" ON "kh_group" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "kh_group_member_person_idx" ON "kh_group_member" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "kh_ledger_debtor_idx" ON "kh_ledger" USING btree ("debtor_id","creditor_id");--> statement-breakpoint
CREATE INDEX "kh_ledger_creditor_idx" ON "kh_ledger" USING btree ("creditor_id","debtor_id");--> statement-breakpoint
CREATE INDEX "kh_ledger_group_idx" ON "kh_ledger" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "kh_ledger_expense_idx" ON "kh_ledger" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "kh_ledger_payment_idx" ON "kh_ledger" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "kh_payment_group_idx" ON "kh_payment" USING btree ("group_id","paid_on");--> statement-breakpoint
CREATE INDEX "kh_payment_from_idx" ON "kh_payment" USING btree ("from_person");--> statement-breakpoint
CREATE INDEX "kh_payment_to_idx" ON "kh_payment" USING btree ("to_person");--> statement-breakpoint
CREATE INDEX "kh_payment_created_by_idx" ON "kh_payment" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "kh_friend_friend_idx" ON "kh_friend" USING btree ("friend_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kh_person_user_unique" ON "kh_person" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kh_person_email_unique" ON "kh_person" USING btree ("email");--> statement-breakpoint
CREATE INDEX "kh_person_created_by_idx" ON "kh_person" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "kh_profile_person_unique" ON "kh_profile" USING btree ("person_id");