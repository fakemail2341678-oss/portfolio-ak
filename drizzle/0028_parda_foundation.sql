CREATE TABLE "pd_blocked_title" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"reason" text NOT NULL,
	"blocked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_blocked_title_media_valid" CHECK ("pd_blocked_title"."media" in ('movie', 'tv'))
);
--> statement-breakpoint
CREATE TABLE "pd_title" (
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"title" jsonb NOT NULL,
	"poster" text,
	"backdrop" text,
	"year" integer,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"runtime" integer,
	"certification" text,
	"popularity_rank" integer,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_title_media_tmdb_id_pk" PRIMARY KEY("media","tmdb_id"),
	CONSTRAINT "pd_title_media_valid" CHECK ("pd_title"."media" in ('movie', 'tv'))
);
--> statement-breakpoint
CREATE TABLE "pd_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"region" text DEFAULT 'US' NOT NULL,
	"languages" jsonb DEFAULT '["en","ne"]'::jsonb NOT NULL,
	"kids_cap" text DEFAULT 'PG' NOT NULL,
	"banner" jsonb,
	"playback_enabled" boolean DEFAULT true NOT NULL,
	"cache_epoch" integer DEFAULT 0 NOT NULL,
	"source_order" text DEFAULT 'auto' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_settings_one_row" CHECK ("pd_settings"."id" = 1),
	CONSTRAINT "pd_settings_source_order_valid" CHECK ("pd_settings"."source_order" in ('auto', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "pd_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" jsonb NOT NULL,
	"movie_template" text NOT NULL,
	"tv_template" text NOT NULL,
	"origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"adapter" text DEFAULT 'none' NOT NULL,
	"sandbox" text DEFAULT 'none' NOT NULL,
	"adaptive" boolean DEFAULT false NOT NULL,
	"needs_click" boolean DEFAULT false NOT NULL,
	"cdn_group" text,
	"auto_fallback" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_source_adapter_valid" CHECK ("pd_source"."adapter" in ('parda', 'none')),
	CONSTRAINT "pd_source_sandbox_valid" CHECK ("pd_source"."sandbox" in ('none', 'popups', 'strict'))
);
--> statement-breakpoint
ALTER TABLE "pd_blocked_title" ADD CONSTRAINT "pd_blocked_title_blocked_by_user_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "pd_settings" ("id") VALUES (1);
--> statement-breakpoint
INSERT INTO "pd_source" ("name", "movie_template", "tv_template", "adapter", "position") VALUES
	('{"en":"Server 1","ne":"सर्भर १"}'::jsonb, '/parda/api/1/movie/{id}?start={start}&lang={lang}', '/parda/api/1/tv/{id}/{season}/{episode}?start={start}&lang={lang}', 'parda', 1),
	('{"en":"Server 2","ne":"सर्भर २"}'::jsonb, '/parda/api/2/movie/{id}?start={start}&lang={lang}', '/parda/api/2/tv/{id}/{season}/{episode}?start={start}&lang={lang}', 'parda', 2),
	('{"en":"Server 3","ne":"सर्भर ३"}'::jsonb, '/parda/api/3/movie/{id}?start={start}&lang={lang}', '/parda/api/3/tv/{id}/{season}/{episode}?start={start}&lang={lang}', 'parda', 3),
	('{"en":"Server 4","ne":"सर्भर ४"}'::jsonb, '/parda/api/4/movie/{id}?start={start}&lang={lang}', '/parda/api/4/tv/{id}/{season}/{episode}?start={start}&lang={lang}', 'parda', 4);
