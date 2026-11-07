CREATE TABLE "tl_automation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger" jsonb NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"created_by_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_automation_name_valid" CHECK (length("tl_automation"."name") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "tl_automation_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"task_id" uuid,
	"outcome" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"key" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_automation_run_outcome_valid" CHECK ("tl_automation_run"."outcome" in ('ok', 'skipped', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "tl_comment" ADD COLUMN "automation" text;--> statement-breakpoint
ALTER TABLE "tl_task" ADD COLUMN "recurrence" jsonb;--> statement-breakpoint
ALTER TABLE "tl_automation" ADD CONSTRAINT "tl_automation_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_automation" ADD CONSTRAINT "tl_automation_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_automation" ADD CONSTRAINT "tl_automation_created_by_id_tl_member_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."tl_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_automation_run" ADD CONSTRAINT "tl_automation_run_automation_id_tl_automation_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."tl_automation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_automation_run" ADD CONSTRAINT "tl_automation_run_task_id_tl_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tl_task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tl_automation_scope_idx" ON "tl_automation" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "tl_automation_run_automation_idx" ON "tl_automation_run" USING btree ("automation_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tl_automation_run_at_idx" ON "tl_automation_run" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "tl_automation_run_key_unique" ON "tl_automation_run" USING btree ("automation_id","key") WHERE "tl_automation_run"."key" is not null;