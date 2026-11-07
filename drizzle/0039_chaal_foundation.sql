CREATE TABLE "ch_connection" (
	"user_id" text PRIMARY KEY NOT NULL,
	"lichess_id" text NOT NULL,
	"username" text NOT NULL,
	"title" text,
	"token" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"cooldown_until" timestamp with time zone,
	"cooldown_ms" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "ch_connection_lichess_id_lower" CHECK ("ch_connection"."lichess_id" = lower("ch_connection"."lichess_id"))
);
--> statement-breakpoint
CREATE TABLE "ch_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"lichess_id" text,
	"reason" text NOT NULL,
	"blocked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ch_block_one_target" CHECK (("ch_block"."user_id" is null) <> ("ch_block"."lichess_id" is null)),
	CONSTRAINT "ch_block_lichess_id_lower" CHECK ("ch_block"."lichess_id" = lower("ch_block"."lichess_id"))
);
--> statement-breakpoint
CREATE TABLE "ch_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"guests_may_connect" boolean DEFAULT true NOT NULL,
	"extra_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cache_epoch" integer DEFAULT 0 NOT NULL,
	"public_cooldown_until" timestamp with time zone,
	"public_cooldown_ms" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ch_settings_one_row" CHECK ("ch_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "ch_connection" ADD CONSTRAINT "ch_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ch_block" ADD CONSTRAINT "ch_block_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ch_block" ADD CONSTRAINT "ch_block_blocked_by_user_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ch_connection_lichess_unique" ON "ch_connection" USING btree ("lichess_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ch_block_user_unique" ON "ch_block" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ch_block_lichess_unique" ON "ch_block" USING btree ("lichess_id");