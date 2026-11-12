CREATE TABLE "kh_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"group_id" uuid,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"accepted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kh_invite_email_lower" CHECK ("kh_invite"."email" = lower("kh_invite"."email"))
);
--> statement-breakpoint
ALTER TABLE "kh_invite" ADD CONSTRAINT "kh_invite_person_id_kh_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_invite" ADD CONSTRAINT "kh_invite_invited_by_kh_person_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."kh_person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_invite" ADD CONSTRAINT "kh_invite_group_id_kh_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."kh_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kh_invite" ADD CONSTRAINT "kh_invite_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kh_invite_token_unique" ON "kh_invite" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "kh_invite_person_idx" ON "kh_invite" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "kh_invite_invited_by_idx" ON "kh_invite" USING btree ("invited_by");--> statement-breakpoint
CREATE INDEX "kh_invite_group_idx" ON "kh_invite" USING btree ("group_id");