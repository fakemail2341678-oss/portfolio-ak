CREATE TYPE "public"."test_crud_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "test_crud" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" "test_crud_status" DEFAULT 'draft' NOT NULL,
	"price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"phone" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"image" uuid,
	"published_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_crud_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "test_crud_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_crud" ADD CONSTRAINT "test_crud_image_test_crud_image_id_fk" FOREIGN KEY ("image") REFERENCES "public"."test_crud_image"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_crud" ADD CONSTRAINT "test_crud_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "test_crud_status_published_idx" ON "test_crud" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "test_crud_updated_idx" ON "test_crud" USING btree ("updated_at");