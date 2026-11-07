CREATE TYPE "public"."portfolio_availability" AS ENUM('open', 'limited', 'closed');--> statement-breakpoint
CREATE TYPE "public"."portfolio_motif" AS ENUM('grid', 'orbit', 'waves', 'blocks', 'type', 'terrain', 'signal');--> statement-breakpoint
CREATE TYPE "public"."portfolio_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "portfolio_contact_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"locale" text NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_experience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company" text NOT NULL,
	"role" jsonb NOT NULL,
	"start" text NOT NULL,
	"end" text,
	"location" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"excerpt" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"cover_id" uuid,
	"status" "portfolio_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_process_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"outputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_profile" (
	"id" text PRIMARY KEY DEFAULT 'profile' NOT NULL,
	"name" jsonb NOT NULL,
	"initials" text NOT NULL,
	"role" jsonb NOT NULL,
	"location" jsonb NOT NULL,
	"timezone" text NOT NULL,
	"email" text NOT NULL,
	"availability_status" "portfolio_availability" DEFAULT 'open' NOT NULL,
	"availability_note" jsonb DEFAULT '{"en":"","ne":""}'::jsonb NOT NULL,
	"headline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"intro" jsonb NOT NULL,
	"manifesto" jsonb NOT NULL,
	"bio" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"principles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"impact" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"socials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"toolbox" text[] DEFAULT '{}'::text[] NOT NULL,
	"since" integer NOT NULL,
	"portrait_id" uuid,
	"resume_id" uuid,
	"seo_title" jsonb DEFAULT '{"en":"","ne":""}'::jsonb NOT NULL,
	"seo_description" jsonb DEFAULT '{"en":"","ne":""}'::jsonb NOT NULL,
	"og_image_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_profile_single" CHECK ("portfolio_profile"."id" = 'profile')
);
--> statement-breakpoint
CREATE TABLE "portfolio_project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"client" jsonb NOT NULL,
	"year" integer NOT NULL,
	"disciplines" text[] DEFAULT '{}'::text[] NOT NULL,
	"role" jsonb NOT NULL,
	"duration" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"stack" text[] DEFAULT '{}'::text[] NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cover_id" uuid,
	"gallery" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"art_seed" text DEFAULT '' NOT NULL,
	"motif" "portfolio_motif" DEFAULT 'grid' NOT NULL,
	"glyph" text NOT NULL,
	"app_slug" text,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "portfolio_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_skill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_testimonial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote" jsonb NOT NULL,
	"name" text NOT NULL,
	"role" jsonb NOT NULL,
	"company" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Alt text becomes { en, ne } (decision 0176): the existing text is the English one.
ALTER TABLE "attachment" ALTER COLUMN "alt" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "attachment" ALTER COLUMN "alt" SET DATA TYPE jsonb USING jsonb_build_object('en', "alt", 'ne', '');--> statement-breakpoint
ALTER TABLE "attachment" ALTER COLUMN "alt" SET DEFAULT '{"en":"","ne":""}'::jsonb;--> statement-breakpoint
ALTER TABLE "portfolio_post" ADD CONSTRAINT "portfolio_post_cover_id_attachment_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."attachment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_post" ADD CONSTRAINT "portfolio_post_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_profile" ADD CONSTRAINT "portfolio_profile_portrait_id_attachment_id_fk" FOREIGN KEY ("portrait_id") REFERENCES "public"."attachment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_profile" ADD CONSTRAINT "portfolio_profile_resume_id_attachment_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."attachment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_profile" ADD CONSTRAINT "portfolio_profile_og_image_id_attachment_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."attachment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_project" ADD CONSTRAINT "portfolio_project_cover_id_attachment_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."attachment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_project" ADD CONSTRAINT "portfolio_project_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portfolio_contact_message_inbox_idx" ON "portfolio_contact_message" USING btree ("archived_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_post_slug_unique" ON "portfolio_post" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "portfolio_post_published_idx" ON "portfolio_post" USING btree ("status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_project_slug_unique" ON "portfolio_project" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "portfolio_project_order_idx" ON "portfolio_project" USING btree ("status","sort_order");