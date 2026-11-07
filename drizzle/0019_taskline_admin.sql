CREATE TABLE "tl_retired_key" (
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"retired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_retired_key_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);
--> statement-breakpoint
ALTER TABLE "tl_invitation" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "tl_invitation" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tl_retired_key" ADD CONSTRAINT "tl_retired_key_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_invitation" ADD CONSTRAINT "tl_invitation_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tl_activity_workspace_idx" ON "tl_activity" USING btree ("workspace_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "tl_invitation_pending_unique" ON "tl_invitation" USING btree ("workspace_id","email") WHERE "tl_invitation"."accepted_at" is null and "tl_invitation"."revoked_at" is null;