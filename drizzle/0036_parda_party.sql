CREATE TABLE "pd_party" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_id" text NOT NULL,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"season" integer,
	"episode" integer,
	"source_id" uuid,
	"state" text DEFAULT 'lobby' NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"state_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_party_code_unique" UNIQUE("code"),
	CONSTRAINT "pd_party_state_valid" CHECK ("pd_party"."state" in ('lobby', 'playing', 'paused', 'ended')),
	CONSTRAINT "pd_party_media_valid" CHECK ("pd_party"."media" in ('movie', 'tv'))
);
--> statement-breakpoint
CREATE TABLE "pd_party_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "pd_party_member_unique" UNIQUE("party_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "pd_party" ADD CONSTRAINT "pd_party_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_party" ADD CONSTRAINT "pd_party_source_id_pd_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."pd_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_party_member" ADD CONSTRAINT "pd_party_member_party_id_pd_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."pd_party"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_party_member" ADD CONSTRAINT "pd_party_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pd_party_expires_idx" ON "pd_party" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "pd_party_member_user_idx" ON "pd_party_member" USING btree ("user_id");