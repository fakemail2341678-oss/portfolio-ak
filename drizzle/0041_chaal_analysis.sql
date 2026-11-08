CREATE TABLE "ch_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"tree" jsonb NOT NULL,
	"start_fen" text NOT NULL,
	"tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"orientation" text DEFAULT 'white' NOT NULL,
	"moves" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ch_settings" ADD COLUMN "engine" jsonb DEFAULT '{"maxDepth":22,"multiPv":3,"hashMb":16}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ch_analysis" ADD CONSTRAINT "ch_analysis_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ch_analysis_owner_updated_idx" ON "ch_analysis" USING btree ("owner_id","updated_at");