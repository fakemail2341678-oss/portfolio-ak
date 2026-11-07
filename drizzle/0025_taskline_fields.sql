CREATE TABLE "tl_field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"position" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_field_name_valid" CHECK (length("tl_field"."name") between 1 and 40),
	CONSTRAINT "tl_field_type_valid" CHECK ("tl_field"."type" in ('text', 'number', 'select', 'multi_select', 'date', 'member', 'checkbox', 'url'))
);
--> statement-breakpoint
ALTER TABLE "tl_task" ADD COLUMN "fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tl_field" ADD CONSTRAINT "tl_field_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_field" ADD CONSTRAINT "tl_field_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tl_field_workspace_name_unique" ON "tl_field" USING btree ("workspace_id",lower("name")) WHERE "tl_field"."project_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "tl_field_project_name_unique" ON "tl_field" USING btree ("project_id",lower("name")) WHERE "tl_field"."project_id" is not null;--> statement-breakpoint
CREATE INDEX "tl_field_workspace_idx" ON "tl_field" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "tl_task_fields_idx" ON "tl_task" USING gin ("fields");