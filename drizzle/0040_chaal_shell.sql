CREATE TABLE "ch_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"board" text NOT NULL,
	"pieces" text NOT NULL,
	"sounds" boolean NOT NULL,
	"volume" integer NOT NULL,
	"auto_queen" boolean NOT NULL,
	"premove" boolean NOT NULL,
	"confirm_moves" boolean NOT NULL,
	"coordinates" boolean NOT NULL,
	"notation" text NOT NULL,
	"zen" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ch_settings" ADD COLUMN "banner" jsonb;--> statement-breakpoint
ALTER TABLE "ch_preference" ADD CONSTRAINT "ch_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;