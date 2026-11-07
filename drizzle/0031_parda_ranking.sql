CREATE TABLE "pd_source_probe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"season" integer,
	"episode" integer,
	"alive" boolean NOT NULL,
	"start_ms" integer,
	"top_height" integer,
	"ladder" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"popups" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"redirects" integer DEFAULT 0 NOT NULL,
	"video_hosts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_source_probe_media_valid" CHECK ("pd_source_probe"."media" in ('movie', 'tv'))
);
--> statement-breakpoint
CREATE TABLE "pd_source_stat" (
	"day" date NOT NULL,
	"source_id" uuid NOT NULL,
	"band" text NOT NULL,
	"plays" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"switched_away" integer DEFAULT 0 NOT NULL,
	"start_median_ms" integer,
	"start_p90_ms" integer,
	"stall_count" integer DEFAULT 0 NOT NULL,
	"stall_ms" bigint DEFAULT 0 NOT NULL,
	"watched_s" bigint DEFAULT 0 NOT NULL,
	"probe_runs" integer DEFAULT 0 NOT NULL,
	"probe_alive" integer DEFAULT 0 NOT NULL,
	"probe_height" integer,
	"probe_adaptive" boolean,
	"probe_popups" integer DEFAULT 0 NOT NULL,
	"probe_clicks" integer DEFAULT 0 NOT NULL,
	"probed_at" timestamp with time zone,
	"score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_source_stat_source_id_day_band_pk" PRIMARY KEY("source_id","day","band"),
	CONSTRAINT "pd_source_stat_band_valid" CHECK ("pd_source_stat"."band" in ('all', 'slow', 'ok', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "pd_source_title_fail" (
	"source_id" uuid NOT NULL,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"failures" integer DEFAULT 1 NOT NULL,
	"first_at" timestamp with time zone NOT NULL,
	"first_client" text NOT NULL,
	"skip_until" timestamp with time zone,
	CONSTRAINT "pd_source_title_fail_media_tmdb_id_source_id_pk" PRIMARY KEY("media","tmdb_id","source_id"),
	CONSTRAINT "pd_source_title_fail_media_valid" CHECK ("pd_source_title_fail"."media" in ('movie', 'tv'))
);
--> statement-breakpoint
ALTER TABLE "pd_source" ALTER COLUMN "adaptive" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pd_source" ALTER COLUMN "adaptive" DROP NOT NULL;--> statement-breakpoint
-- Until now "adaptive" defaulted to false: that was no one's word, so the probe decides (decision 0238). An admin's true stays.
UPDATE "pd_source" SET "adaptive" = NULL WHERE "adaptive" = false;--> statement-breakpoint
ALTER TABLE "pd_source" ADD COLUMN "quality" integer;--> statement-breakpoint
ALTER TABLE "pd_source_probe" ADD CONSTRAINT "pd_source_probe_source_id_pd_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."pd_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_source_stat" ADD CONSTRAINT "pd_source_stat_source_id_pd_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."pd_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_source_title_fail" ADD CONSTRAINT "pd_source_title_fail_source_id_pd_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."pd_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pd_source_probe_source_idx" ON "pd_source_probe" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE INDEX "pd_source_stat_day_idx" ON "pd_source_stat" USING btree ("day");--> statement-breakpoint
CREATE INDEX "pd_play_created_idx" ON "pd_play" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "pd_source" ADD CONSTRAINT "pd_source_quality_valid" CHECK ("pd_source"."quality" between 144 and 4320);