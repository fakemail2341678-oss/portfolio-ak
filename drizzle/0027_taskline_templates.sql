CREATE TABLE "tl_project_update" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"author_id" uuid,
	"health" text NOT NULL,
	"body_html" text DEFAULT '' NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_project_update_health_valid" CHECK ("tl_project_update"."health" in ('on_track', 'at_risk', 'off_track'))
);
--> statement-breakpoint
CREATE TABLE "tl_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"definition" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_template_name_valid" CHECK (length("tl_template"."name") between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "tl_project_update" ADD CONSTRAINT "tl_project_update_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_project_update" ADD CONSTRAINT "tl_project_update_author_id_tl_member_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."tl_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_template" ADD CONSTRAINT "tl_template_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tl_project_update_project_idx" ON "tl_project_update" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "tl_template_name_unique" ON "tl_template" USING btree ("workspace_id",lower("name"));