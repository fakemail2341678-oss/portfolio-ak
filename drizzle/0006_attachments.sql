CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"version" bigint NOT NULL,
	"resource_type" text DEFAULT 'image' NOT NULL,
	"format" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text DEFAULT '' NOT NULL,
	"owner_id" text,
	"entity_type" text,
	"entity_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "attachment_publicId_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_entity_idx" ON "attachment" USING btree ("entity_type","entity_id","position");--> statement-breakpoint
CREATE INDEX "attachment_cleanup_idx" ON "attachment" USING btree ("deleted_at","entity_type","created_at");