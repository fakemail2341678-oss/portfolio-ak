CREATE TABLE "pd_billboard" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page" text NOT NULL,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"tagline" jsonb,
	"starts_on" date,
	"ends_on" date,
	"position" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_billboard_page_valid" CHECK ("pd_billboard"."page" in ('home', 'movies', 'series', 'anime')),
	CONSTRAINT "pd_billboard_media_valid" CHECK ("pd_billboard"."media" in ('movie', 'tv')),
	CONSTRAINT "pd_billboard_dates_valid" CHECK ("pd_billboard"."starts_on" <= "pd_billboard"."ends_on")
);
--> statement-breakpoint
CREATE TABLE "pd_collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"published" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pd_collection_item" (
	"collection_id" uuid NOT NULL,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pd_collection_item_pk" PRIMARY KEY("collection_id","media","tmdb_id"),
	CONSTRAINT "pd_collection_item_media_valid" CHECK ("pd_collection_item"."media" in ('movie', 'tv'))
);
--> statement-breakpoint
CREATE TABLE "pd_daily_stat" (
	"day" date PRIMARY KEY NOT NULL,
	"account_plays" integer DEFAULT 0 NOT NULL,
	"guest_plays" integer DEFAULT 0 NOT NULL,
	"anonymous_plays" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"viewers" integer DEFAULT 0 NOT NULL,
	"watched_s" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pd_rail" (
	"page" text NOT NULL,
	"key" text NOT NULL,
	"collection_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	CONSTRAINT "pd_rail_pk" PRIMARY KEY("page","key"),
	CONSTRAINT "pd_rail_page_valid" CHECK ("pd_rail"."page" in ('home', 'movies', 'series', 'anime'))
);
--> statement-breakpoint
ALTER TABLE "pd_play" ADD COLUMN "viewer_key" text;--> statement-breakpoint
ALTER TABLE "pd_collection_item" ADD CONSTRAINT "pd_collection_item_collection_id_pd_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."pd_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_rail" ADD CONSTRAINT "pd_rail_collection_id_pd_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."pd_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pd_billboard_page_idx" ON "pd_billboard" USING btree ("page","position");--> statement-breakpoint
CREATE UNIQUE INDEX "pd_collection_slug_unique" ON "pd_collection" USING btree ("slug");