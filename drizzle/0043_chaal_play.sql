CREATE TABLE "ch_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"mode" text,
	"ref" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ch_settings" ADD COLUMN "play" jsonb DEFAULT '{"aiMaxLevel":8,"rated":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ch_activity" ADD CONSTRAINT "ch_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ch_activity_at_idx" ON "ch_activity" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "ch_activity_ref_unique" ON "ch_activity" USING btree ("user_id","kind","ref") WHERE "ch_activity"."ref" is not null;