CREATE TABLE "pd_account" (
	"user_id" text PRIMARY KEY NOT NULL,
	"digest" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pd_favourite_person" (
	"profile_id" uuid NOT NULL,
	"person_id" integer NOT NULL,
	"name" text NOT NULL,
	"portrait" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_favourite_person_pk" PRIMARY KEY("profile_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "pd_list_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_list_item_unique" UNIQUE("profile_id","kind","media","tmdb_id"),
	CONSTRAINT "pd_list_item_kind_valid" CHECK ("pd_list_item"."kind" in ('watchlist', 'favourite')),
	CONSTRAINT "pd_list_item_media_valid" CHECK ("pd_list_item"."media" in ('movie', 'tv'))
);
--> statement-breakpoint
CREATE TABLE "pd_rating" (
	"profile_id" uuid NOT NULL,
	"media" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"value" text NOT NULL,
	"rated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_rating_pk" PRIMARY KEY("profile_id","media","tmdb_id"),
	CONSTRAINT "pd_rating_value_valid" CHECK ("pd_rating"."value" in ('like', 'dislike')),
	CONSTRAINT "pd_rating_media_valid" CHECK ("pd_rating"."media" in ('movie', 'tv'))
);
--> statement-breakpoint
ALTER TABLE "pd_title" ADD COLUMN "certification_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pd_account" ADD CONSTRAINT "pd_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_favourite_person" ADD CONSTRAINT "pd_favourite_person_profile_id_pd_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."pd_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_list_item" ADD CONSTRAINT "pd_list_item_profile_id_pd_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."pd_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pd_rating" ADD CONSTRAINT "pd_rating_profile_id_pd_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."pd_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pd_favourite_person_recent_idx" ON "pd_favourite_person" USING btree ("profile_id","added_at");--> statement-breakpoint
CREATE INDEX "pd_list_item_recent_idx" ON "pd_list_item" USING btree ("profile_id","kind","added_at");--> statement-breakpoint
CREATE INDEX "pd_rating_recent_idx" ON "pd_rating" USING btree ("profile_id","value","rated_at");