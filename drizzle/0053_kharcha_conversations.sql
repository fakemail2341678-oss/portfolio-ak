CREATE TABLE "kh_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"person_lo" uuid,
	"person_hi" uuid,
	"expense_id" uuid,
	"author_id" uuid,
	"body" text NOT NULL,
	"mentions" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "kh_comment_one_thread" CHECK (num_nonnulls("kh_comment"."group_id", "kh_comment"."person_lo", "kh_comment"."expense_id") = 1 and ("kh_comment"."person_lo" is null) = ("kh_comment"."person_hi" is null)),
	CONSTRAINT "kh_comment_pair_ordered" CHECK ("kh_comment"."person_lo" is null or "kh_comment"."person_lo" < "kh_comment"."person_hi")
);
--> statement-breakpoint
CREATE TABLE "kh_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"thread" text NOT NULL,
	"group_id" uuid,
	"expense_id" uuid,
	"actor_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"email" text DEFAULT 'none' NOT NULL,
	"emailed_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_notification_email_valid" CHECK ("kh_notification"."email" in ('instant', 'digest', 'none'))
);
--> statement-breakpoint
CREATE TABLE "kh_reaction" (
	"comment_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_reaction_comment_id_person_id_emoji_pk" PRIMARY KEY("comment_id","person_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "kh_read" (
	"person_id" uuid NOT NULL,
	"thread" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_read_person_id_thread_pk" PRIMARY KEY("person_id","thread")
);
--> statement-breakpoint
ALTER TABLE "kh_person" ADD COLUMN "mailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kh_person" ADD COLUMN "unsubscribed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kh_comment" ADD CONSTRAINT "kh_comment_group_id_kh_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."kh_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_comment" ADD CONSTRAINT "kh_comment_person_lo_kh_person_id_fk" FOREIGN KEY ("person_lo") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_comment" ADD CONSTRAINT "kh_comment_person_hi_kh_person_id_fk" FOREIGN KEY ("person_hi") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_comment" ADD CONSTRAINT "kh_comment_expense_id_kh_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."kh_expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_comment" ADD CONSTRAINT "kh_comment_author_id_kh_person_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."kh_person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_notification" ADD CONSTRAINT "kh_notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_notification" ADD CONSTRAINT "kh_notification_group_id_kh_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."kh_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_notification" ADD CONSTRAINT "kh_notification_expense_id_kh_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."kh_expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_notification" ADD CONSTRAINT "kh_notification_actor_id_kh_person_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."kh_person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_reaction" ADD CONSTRAINT "kh_reaction_comment_id_kh_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."kh_comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_reaction" ADD CONSTRAINT "kh_reaction_person_id_kh_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_read" ADD CONSTRAINT "kh_read_person_id_kh_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kh_comment_group_idx" ON "kh_comment" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "kh_comment_pair_idx" ON "kh_comment" USING btree ("person_lo","person_hi","created_at");--> statement-breakpoint
CREATE INDEX "kh_comment_expense_idx" ON "kh_comment" USING btree ("expense_id","created_at");--> statement-breakpoint
CREATE INDEX "kh_comment_author_idx" ON "kh_comment" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "kh_notification_inbox_idx" ON "kh_notification" USING btree ("user_id","read_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "kh_notification_outbox_idx" ON "kh_notification" USING btree ("email","created_at") WHERE "kh_notification"."emailed_at" is null and "kh_notification"."email" <> 'none';--> statement-breakpoint
CREATE INDEX "kh_notification_thread_idx" ON "kh_notification" USING btree ("user_id","thread");--> statement-breakpoint
CREATE INDEX "kh_notification_group_idx" ON "kh_notification" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "kh_notification_expense_idx" ON "kh_notification" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "kh_notification_actor_idx" ON "kh_notification" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "kh_reaction_person_idx" ON "kh_reaction" USING btree ("person_id");