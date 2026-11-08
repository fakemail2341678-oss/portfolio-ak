CREATE TABLE "ch_local_game" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"mode" text NOT NULL,
	"level" integer,
	"color" text,
	"clock" jsonb,
	"layout" text,
	"pgn" text NOT NULL,
	"moves" integer DEFAULT 0 NOT NULL,
	"clocks" jsonb,
	"result" text,
	"reason" text,
	"status" text DEFAULT 'playing' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ch_local_game" ADD CONSTRAINT "ch_local_game_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ch_local_game_owner_played_idx" ON "ch_local_game" USING btree ("owner_id","played_at");