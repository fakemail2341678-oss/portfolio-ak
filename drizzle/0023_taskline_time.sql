CREATE TABLE "tl_time_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"member_id" uuid NOT NULL,
	"on_day" date NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"billable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_time_entry_minutes_valid" CHECK ("tl_time_entry"."minutes" between 0 and 1440),
	CONSTRAINT "tl_time_entry_timer_valid" CHECK ("tl_time_entry"."ended_at" is null or "tl_time_entry"."started_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "tl_sprint" ADD COLUMN "committed_minutes" integer;--> statement-breakpoint
ALTER TABLE "tl_sprint" ADD COLUMN "completed_minutes" integer;--> statement-breakpoint
ALTER TABLE "tl_sprint_snapshot" ADD COLUMN "scope_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tl_sprint_snapshot" ADD COLUMN "done_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tl_task" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "tl_time_entry" ADD CONSTRAINT "tl_time_entry_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_time_entry" ADD CONSTRAINT "tl_time_entry_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_time_entry" ADD CONSTRAINT "tl_time_entry_task_id_tl_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tl_task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_time_entry" ADD CONSTRAINT "tl_time_entry_member_id_tl_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."tl_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tl_time_entry_member_day_idx" ON "tl_time_entry" USING btree ("member_id","on_day");--> statement-breakpoint
CREATE INDEX "tl_time_entry_project_day_idx" ON "tl_time_entry" USING btree ("project_id","on_day");--> statement-breakpoint
CREATE INDEX "tl_time_entry_workspace_day_idx" ON "tl_time_entry" USING btree ("workspace_id","on_day");--> statement-breakpoint
CREATE INDEX "tl_time_entry_task_idx" ON "tl_time_entry" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tl_time_entry_one_running" ON "tl_time_entry" USING btree ("member_id") WHERE "tl_time_entry"."started_at" is not null and "tl_time_entry"."ended_at" is null;--> statement-breakpoint
ALTER TABLE "tl_task" ADD CONSTRAINT "tl_task_estimate_valid" CHECK ("tl_task"."estimate_minutes" between 0 and 60000);