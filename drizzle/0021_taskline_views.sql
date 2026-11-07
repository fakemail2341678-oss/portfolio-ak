CREATE TABLE "tl_import" (
	"key" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tl_saved_view" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"view" text NOT NULL,
	"search" text NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_saved_view_kind_valid" CHECK ("tl_saved_view"."view" in ('list', 'board', 'calendar')),
	CONSTRAINT "tl_saved_view_search_valid" CHECK ("tl_saved_view"."search" = '' or (left("tl_saved_view"."search", 1) = '?' and length("tl_saved_view"."search") <= 2000))
);
--> statement-breakpoint
ALTER TABLE "tl_import" ADD CONSTRAINT "tl_import_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_import" ADD CONSTRAINT "tl_import_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_saved_view" ADD CONSTRAINT "tl_saved_view_workspace_id_tl_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."tl_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_saved_view" ADD CONSTRAINT "tl_saved_view_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_saved_view" ADD CONSTRAINT "tl_saved_view_member_id_tl_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."tl_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tl_import_project_idx" ON "tl_import" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tl_saved_view_name_unique" ON "tl_saved_view" USING btree ("project_id","member_id","view",lower("name"));--> statement-breakpoint
CREATE INDEX "tl_saved_view_project_idx" ON "tl_saved_view" USING btree ("project_id","view");