CREATE TABLE "tl_milestone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"due_on" date,
	"completed_at" timestamp with time zone,
	"position" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_milestone_name_valid" CHECK (length("tl_milestone"."name") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "tl_task_dependency" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_task_dependency_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "tl_task_dependency_not_self" CHECK ("tl_task_dependency"."blocker_id" <> "tl_task_dependency"."blocked_id")
);
--> statement-breakpoint
ALTER TABLE "tl_task" ADD COLUMN "milestone_id" uuid;--> statement-breakpoint
ALTER TABLE "tl_milestone" ADD CONSTRAINT "tl_milestone_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task_dependency" ADD CONSTRAINT "tl_task_dependency_blocker_id_tl_task_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."tl_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task_dependency" ADD CONSTRAINT "tl_task_dependency_blocked_id_tl_task_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."tl_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tl_milestone_project_idx" ON "tl_milestone" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tl_task_dependency_blocked_idx" ON "tl_task_dependency" USING btree ("blocked_id");--> statement-breakpoint
ALTER TABLE "tl_task" ADD CONSTRAINT "tl_task_milestone_id_tl_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."tl_milestone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tl_task_milestone_idx" ON "tl_task" USING btree ("milestone_id");