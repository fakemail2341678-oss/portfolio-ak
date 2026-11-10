CREATE TABLE "ch_daily_stat" (
	"day" date PRIMARY KEY NOT NULL,
	"players" integer DEFAULT 0 NOT NULL,
	"connects" integer DEFAULT 0 NOT NULL,
	"games" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"puzzles" integer DEFAULT 0 NOT NULL,
	"puzzles_solved" integer DEFAULT 0 NOT NULL,
	"analyses" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ch_featured" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"title" jsonb NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"position" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ch_featured_kind_valid" CHECK ("ch_featured"."kind" in ('broadcast', 'arena', 'swiss', 'study', 'theme')),
	CONSTRAINT "ch_featured_dates_valid" CHECK ("ch_featured"."starts_on" <= "ch_featured"."ends_on")
);
--> statement-breakpoint
CREATE TABLE "ch_home_section" (
	"key" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ch_settings" ADD COLUMN "announcement" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "ch_featured_ref_unique" ON "ch_featured" USING btree ("kind","ref");--> statement-breakpoint
CREATE INDEX "ch_featured_position_idx" ON "ch_featured" USING btree ("position");