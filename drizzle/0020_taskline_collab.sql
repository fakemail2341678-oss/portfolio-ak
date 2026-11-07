CREATE TABLE "tl_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid,
	"body_html" text NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"mentions" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tl_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"actor_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"email" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	CONSTRAINT "tl_notification_email_valid" CHECK ("tl_notification"."email" in ('instant', 'digest', 'none'))
);
--> statement-breakpoint
ALTER TABLE "tl_member" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "tl_comment" ADD CONSTRAINT "tl_comment_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_comment" ADD CONSTRAINT "tl_comment_task_id_tl_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tl_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_comment" ADD CONSTRAINT "tl_comment_author_id_tl_member_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."tl_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_notification" ADD CONSTRAINT "tl_notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_notification" ADD CONSTRAINT "tl_notification_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_notification" ADD CONSTRAINT "tl_notification_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_notification" ADD CONSTRAINT "tl_notification_task_id_tl_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tl_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_notification" ADD CONSTRAINT "tl_notification_actor_id_tl_member_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."tl_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tl_comment_task_idx" ON "tl_comment" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "tl_notification_inbox_idx" ON "tl_notification" USING btree ("user_id","read_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tl_notification_outbox_idx" ON "tl_notification" USING btree ("email","created_at") WHERE "tl_notification"."emailed_at" is null and "tl_notification"."email" <> 'none';--> statement-breakpoint
CREATE INDEX "tl_notification_task_idx" ON "tl_notification" USING btree ("task_id","user_id");