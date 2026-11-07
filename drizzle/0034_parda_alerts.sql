CREATE TABLE "pd_follow_state" (
	"tmdb_id" integer PRIMARY KEY NOT NULL,
	"last_season" integer,
	"last_episode" integer,
	"last_air_date" date,
	"next_air_date" date,
	"ended" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pd_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" text DEFAULT 'episode' NOT NULL,
	"tmdb_id" integer NOT NULL,
	"season" integer NOT NULL,
	"episode" integer NOT NULL,
	"last_episode" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	CONSTRAINT "pd_notification_unique" UNIQUE("profile_id","tmdb_id","season","last_episode"),
	CONSTRAINT "pd_notification_kind_valid" CHECK ("pd_notification"."kind" in ('episode')),
	CONSTRAINT "pd_notification_range_valid" CHECK ("pd_notification"."last_episode" >= "pd_notification"."episode")
);
--> statement-breakpoint
ALTER TABLE "pd_account" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "pd_notification" ADD CONSTRAINT "pd_notification_profile_id_pd_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."pd_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pd_follow_state_checked_idx" ON "pd_follow_state" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "pd_notification_recent_idx" ON "pd_notification" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "pd_notification_digest_idx" ON "pd_notification" USING btree ("created_at") WHERE "pd_notification"."emailed_at" is null;