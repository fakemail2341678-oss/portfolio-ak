CREATE TABLE "tl_label" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tl_project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description_html" text DEFAULT '' NOT NULL,
	"description_text" text DEFAULT '' NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"visibility" text DEFAULT 'team' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"health" text,
	"lead_id" uuid,
	"start_on" date,
	"target_on" date,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"task_seq" integer DEFAULT 0 NOT NULL,
	"rev" bigint DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_project_key_valid" CHECK ("tl_project"."key" ~ '^[A-Z][A-Z0-9]{1,5}$'),
	CONSTRAINT "tl_project_visibility_valid" CHECK ("tl_project"."visibility" in ('team', 'private')),
	CONSTRAINT "tl_project_status_valid" CHECK ("tl_project"."status" in ('active', 'paused', 'completed', 'archived')),
	CONSTRAINT "tl_project_health_valid" CHECK ("tl_project"."health" in ('on_track', 'at_risk', 'off_track'))
);
--> statement-breakpoint
CREATE TABLE "tl_project_member" (
	"project_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_project_member_project_id_member_id_pk" PRIMARY KEY("project_id","member_id"),
	CONSTRAINT "tl_project_member_role_valid" CHECK ("tl_project_member"."role" in ('lead', 'member', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "tl_star" (
	"member_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_star_member_id_project_id_pk" PRIMARY KEY("member_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "tl_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"position" text NOT NULL,
	"wip_limit" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_status_category_valid" CHECK ("tl_status"."category" in ('backlog', 'unstarted', 'started', 'completed', 'canceled')),
	CONSTRAINT "tl_status_wip_positive" CHECK ("tl_status"."wip_limit" > 0)
);
--> statement-breakpoint
CREATE TABLE "tl_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"actor_id" uuid,
	"kind" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tl_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"type" text DEFAULT 'task' NOT NULL,
	"title" text NOT NULL,
	"description_html" text DEFAULT '' NOT NULL,
	"description_text" text DEFAULT '' NOT NULL,
	"status_id" uuid NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"assignee_id" uuid,
	"reporter_id" uuid,
	"parent_id" uuid,
	"position" text NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_on" date,
	"due_on" date,
	"completed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', title), 'A') || setweight(to_tsvector('simple', description_text), 'B')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tl_task_type_valid" CHECK ("tl_task"."type" in ('task', 'bug', 'story', 'epic')),
	CONSTRAINT "tl_task_priority_valid" CHECK ("tl_task"."priority" between 0 and 4),
	CONSTRAINT "tl_task_not_own_parent" CHECK ("tl_task"."parent_id" <> "tl_task"."id")
);
--> statement-breakpoint
CREATE TABLE "tl_task_label" (
	"task_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "tl_task_label_task_id_label_id_pk" PRIMARY KEY("task_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "tl_task_watcher" (
	"task_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "tl_task_watcher_task_id_member_id_pk" PRIMARY KEY("task_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "tl_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_invitation_email_lowercase" CHECK ("tl_invitation"."email" = lower("tl_invitation"."email"))
);
--> statement-breakpoint
CREATE TABLE "tl_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"capacity_minutes_week" integer DEFAULT 2400 NOT NULL,
	"notify" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_member_role_valid" CHECK ("tl_member"."role" in ('member', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "tl_workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"owner_id" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_workspace_kind_valid" CHECK ("tl_workspace"."kind" in ('team', 'sandbox')),
	CONSTRAINT "tl_workspace_owner_matches_kind" CHECK (("tl_workspace"."kind" = 'team') = ("tl_workspace"."owner_id" is null))
);
--> statement-breakpoint
ALTER TABLE "tl_label" ADD CONSTRAINT "tl_label_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_label" ADD CONSTRAINT "tl_label_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_project" ADD CONSTRAINT "tl_project_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_project" ADD CONSTRAINT "tl_project_lead_id_tl_member_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."tl_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_project_member" ADD CONSTRAINT "tl_project_member_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_project_member" ADD CONSTRAINT "tl_project_member_member_id_tl_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."tl_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_star" ADD CONSTRAINT "tl_star_member_id_tl_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."tl_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_star" ADD CONSTRAINT "tl_star_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_status" ADD CONSTRAINT "tl_status_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_activity" ADD CONSTRAINT "tl_activity_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_activity" ADD CONSTRAINT "tl_activity_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_activity" ADD CONSTRAINT "tl_activity_task_id_tl_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tl_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_activity" ADD CONSTRAINT "tl_activity_actor_id_tl_member_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."tl_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task" ADD CONSTRAINT "tl_task_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task" ADD CONSTRAINT "tl_task_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task" ADD CONSTRAINT "tl_task_status_id_tl_status_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."tl_status"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task" ADD CONSTRAINT "tl_task_assignee_id_tl_member_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."tl_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task" ADD CONSTRAINT "tl_task_reporter_id_tl_member_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."tl_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task" ADD CONSTRAINT "tl_task_parent_id_tl_task_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tl_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task_label" ADD CONSTRAINT "tl_task_label_task_id_tl_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tl_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task_label" ADD CONSTRAINT "tl_task_label_label_id_tl_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."tl_label"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task_watcher" ADD CONSTRAINT "tl_task_watcher_task_id_tl_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tl_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_task_watcher" ADD CONSTRAINT "tl_task_watcher_member_id_tl_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."tl_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_invitation" ADD CONSTRAINT "tl_invitation_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_invitation" ADD CONSTRAINT "tl_invitation_invited_by_id_tl_member_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."tl_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_member" ADD CONSTRAINT "tl_member_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_member" ADD CONSTRAINT "tl_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_workspace" ADD CONSTRAINT "tl_workspace_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tl_label_workspace_name_unique" ON "tl_label" USING btree ("workspace_id",lower("name")) WHERE "tl_label"."project_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "tl_label_project_name_unique" ON "tl_label" USING btree ("project_id",lower("name")) WHERE "tl_label"."project_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tl_project_key_unique" ON "tl_project" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "tl_project_member_member_idx" ON "tl_project_member" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "tl_status_project_idx" ON "tl_status" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "tl_activity_project_idx" ON "tl_activity" USING btree ("project_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tl_activity_task_idx" ON "tl_activity" USING btree ("task_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "tl_task_number_unique" ON "tl_task" USING btree ("project_id","number");--> statement-breakpoint
CREATE INDEX "tl_task_status_idx" ON "tl_task" USING btree ("status_id","position");--> statement-breakpoint
CREATE INDEX "tl_task_assignee_idx" ON "tl_task" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "tl_task_parent_idx" ON "tl_task" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "tl_task_workspace_due_idx" ON "tl_task" USING btree ("workspace_id","due_on");--> statement-breakpoint
CREATE INDEX "tl_task_search_idx" ON "tl_task" USING gin ("search");--> statement-breakpoint
CREATE INDEX "tl_task_label_label_idx" ON "tl_task_label" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "tl_task_watcher_member_idx" ON "tl_task_watcher" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "tl_invitation_email_idx" ON "tl_invitation" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "tl_member_workspace_user_unique" ON "tl_member" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "tl_member_user_idx" ON "tl_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tl_workspace_one_team" ON "tl_workspace" USING btree ("kind") WHERE "tl_workspace"."kind" = 'team';--> statement-breakpoint
CREATE UNIQUE INDEX "tl_workspace_owner_unique" ON "tl_workspace" USING btree ("owner_id");--> statement-breakpoint
-- The one team workspace (decision 0203), with the default settings (defaults live in code: src/features/taskline/settings.ts).
INSERT INTO "tl_workspace" ("kind", "slug", "name", "settings") VALUES ('team', 'team', 'Team', '{}'::jsonb);
