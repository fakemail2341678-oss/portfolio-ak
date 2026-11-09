CREATE TABLE "ch_api_error" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"endpoint" text NOT NULL,
	"status" integer NOT NULL,
	"ms" integer NOT NULL,
	"lane" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ch_api_stat" (
	"hour" timestamp with time zone NOT NULL,
	"endpoint" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"rate_limited" integer DEFAULT 0 NOT NULL,
	"total_ms" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ch_api_stat_hour_endpoint_pk" PRIMARY KEY("hour","endpoint")
);
--> statement-breakpoint
ALTER TABLE "ch_settings" ALTER COLUMN "play" SET DEFAULT '{"aiMaxLevel":8,"rated":true,"quickPair":"all"}'::jsonb;--> statement-breakpoint
ALTER TABLE "ch_settings" ADD COLUMN "defaults" jsonb DEFAULT '{"board":"diagram","pieces":"cburnett","sounds":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ch_settings" ADD COLUMN "maintenance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ch_settings" ADD COLUMN "maintenance_message" jsonb;--> statement-breakpoint
CREATE INDEX "ch_api_error_at_idx" ON "ch_api_error" USING btree ("at");