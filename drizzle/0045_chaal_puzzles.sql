CREATE TABLE "ch_puzzle_attempt" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"puzzle_id" text NOT NULL,
	"won" boolean NOT NULL,
	"ms" integer NOT NULL,
	"rating" integer NOT NULL,
	"themes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mode" text NOT NULL,
	"angle" text DEFAULT 'mix' NOT NULL,
	"streak" integer,
	"lichess" text,
	"rating_diff" integer,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ch_settings" ADD COLUMN "puzzles" jsonb DEFAULT '{"ahead":15,"streak":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ch_puzzle_attempt" ADD CONSTRAINT "ch_puzzle_attempt_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ch_puzzle_attempt_owner_at_idx" ON "ch_puzzle_attempt" USING btree ("owner_id","at");--> statement-breakpoint
CREATE INDEX "ch_puzzle_attempt_pending_idx" ON "ch_puzzle_attempt" USING btree ("owner_id") WHERE "ch_puzzle_attempt"."lichess" = 'pending';