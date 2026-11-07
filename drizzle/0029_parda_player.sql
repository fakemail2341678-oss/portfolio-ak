CREATE TABLE "pd_play" (
	"id" uuid PRIMARY KEY NOT NULL,
	"viewer_kind" text NOT NULL,
	"source_id" uuid,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"season" integer,
	"episode" integer,
	"failed" boolean DEFAULT false NOT NULL,
	"fail_reason" text,
	"start_ms" integer,
	"stall_count" integer DEFAULT 0 NOT NULL,
	"stall_ms" integer DEFAULT 0 NOT NULL,
	"watched_s" integer DEFAULT 0 NOT NULL,
	"switched_away" boolean DEFAULT false NOT NULL,
	"band" text DEFAULT 'unknown' NOT NULL,
	"in_party" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_play_viewer_kind_valid" CHECK ("pd_play"."viewer_kind" in ('account', 'guest', 'anonymous')),
	CONSTRAINT "pd_play_band_valid" CHECK ("pd_play"."band" in ('slow', 'ok', 'unknown')),
	CONSTRAINT "pd_play_media_valid" CHECK ("pd_play"."media" in ('movie', 'tv'))
);
--> statement-breakpoint
CREATE TABLE "pd_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"season" integer,
	"episode" integer,
	"source_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reporter_id" text,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_report_kind_valid" CHECK ("pd_report"."kind" in ('not-playing', 'wrong-title', 'quality', 'audio-subtitles', 'ads', 'other')),
	CONSTRAINT "pd_report_status_valid" CHECK ("pd_report"."status" in ('open', 'resolved', 'dismissed')),
	CONSTRAINT "pd_report_media_valid" CHECK ("pd_report"."media" in ('movie', 'tv'))
);
--> statement-breakpoint
CREATE TABLE "pd_continue_state" (
	"profile_id" uuid NOT NULL,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"hidden_at" timestamp with time zone,
	"rewatch_at" timestamp with time zone,
	CONSTRAINT "pd_continue_state_profile_id_media_tmdb_id_pk" PRIMARY KEY("profile_id","media","tmdb_id"),
	CONSTRAINT "pd_continue_state_media_valid" CHECK ("pd_continue_state"."media" in ('movie', 'tv'))
);
--> statement-breakpoint
CREATE TABLE "pd_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"avatar" text,
	"kids" boolean DEFAULT false NOT NULL,
	"cap" text,
	"pin_hash" text,
	"region" text,
	"audio_language" text,
	"autoplay" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pd_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"season" integer,
	"episode" integer,
	"watched" integer DEFAULT 0 NOT NULL,
	"duration" integer,
	"source_id" uuid,
	"finished" boolean DEFAULT false NOT NULL,
	"marked" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_progress_episode_unique" UNIQUE NULLS NOT DISTINCT("profile_id","media","tmdb_id","season","episode"),
	CONSTRAINT "pd_progress_media_valid" CHECK ("pd_progress"."media" in ('movie', 'tv')),
	CONSTRAINT "pd_progress_episode_valid" CHECK (("pd_progress"."media" = 'movie' and "pd_progress"."season" is null and "pd_progress"."episode" is null) or ("pd_progress"."media" = 'tv' and "pd_progress"."season" is not null and "pd_progress"."episode" is not null))
);
--> statement-breakpoint
ALTER TABLE "pd_play" ADD CONSTRAINT "pd_play_source_id_pd_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."pd_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_report" ADD CONSTRAINT "pd_report_source_id_pd_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."pd_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_report" ADD CONSTRAINT "pd_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_report" ADD CONSTRAINT "pd_report_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_continue_state" ADD CONSTRAINT "pd_continue_state_profile_id_pd_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."pd_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_profile" ADD CONSTRAINT "pd_profile_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_progress" ADD CONSTRAINT "pd_progress_profile_id_pd_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."pd_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_progress" ADD CONSTRAINT "pd_progress_source_id_pd_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."pd_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pd_play_source_idx" ON "pd_play" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE INDEX "pd_report_status_idx" ON "pd_report" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "pd_report_source_idx" ON "pd_report" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "pd_profile_owner_idx" ON "pd_profile" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pd_profile_default_unique" ON "pd_profile" USING btree ("owner_id") WHERE "pd_profile"."is_default";--> statement-breakpoint
CREATE INDEX "pd_progress_recent_idx" ON "pd_progress" USING btree ("profile_id","updated_at");--> statement-breakpoint
-- The placeholder servers rehearse falling back across CDN groups (decision 0236): 1 and 2 fail together, 3 and 4 too.
UPDATE "pd_source" SET "cdn_group" = 'placeholder-a' WHERE "movie_template" LIKE '/parda/api/1/%' OR "movie_template" LIKE '/parda/api/2/%';--> statement-breakpoint
UPDATE "pd_source" SET "cdn_group" = 'placeholder-b' WHERE "movie_template" LIKE '/parda/api/3/%' OR "movie_template" LIKE '/parda/api/4/%';
