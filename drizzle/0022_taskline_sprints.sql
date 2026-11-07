CREATE TABLE "tl_sprint" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'planned' NOT NULL,
	"start_on" date NOT NULL,
	"end_on" date NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"committed_points" integer,
	"committed_tasks" integer,
	"completed_points" integer,
	"completed_tasks" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_sprint_state_valid" CHECK ("tl_sprint"."state" in ('planned', 'active', 'completed')),
	CONSTRAINT "tl_sprint_dates_valid" CHECK ("tl_sprint"."end_on" >= "tl_sprint"."start_on")
);
--> statement-breakpoint
CREATE TABLE "tl_sprint_snapshot" (
	"sprint_id" uuid NOT NULL,
	"day" date NOT NULL,
	"scope_points" integer NOT NULL,
	"done_points" integer NOT NULL,
	"scope_tasks" integer NOT NULL,
	"done_tasks" integer NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tl_sprint_snapshot_sprint_id_day_pk" PRIMARY KEY("sprint_id","day")
);
--> statement-breakpoint
ALTER TABLE "tl_task" ADD COLUMN "sprint_id" uuid;--> statement-breakpoint
ALTER TABLE "tl_task" ADD COLUMN "points" smallint;--> statement-breakpoint
ALTER TABLE "tl_task" ADD COLUMN "rank" text;--> statement-breakpoint
-- Every task gets a backlog rank in its project's number order: a fractional order key
-- (src/lib/fractional-index.ts) with a four-character integer part, "c" and three base-62
-- digits ("c000", "c001" …), room for 238,328 tasks per project.
UPDATE "tl_task" SET "rank" = ranked."rank"
FROM (
	SELECT "id", 'c'
		|| substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', ((n / 3844) % 62)::int + 1, 1)
		|| substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', ((n / 62) % 62)::int + 1, 1)
		|| substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', (n % 62)::int + 1, 1) AS "rank"
	FROM (SELECT "id", row_number() OVER (PARTITION BY "project_id" ORDER BY "number") - 1 AS n FROM "tl_task") numbered
) ranked
WHERE "tl_task"."id" = ranked."id";--> statement-breakpoint
ALTER TABLE "tl_task" ALTER COLUMN "rank" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tl_sprint" ADD CONSTRAINT "tl_sprint_project_id_tl_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tl_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tl_sprint_snapshot" ADD CONSTRAINT "tl_sprint_snapshot_sprint_id_tl_sprint_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."tl_sprint"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tl_sprint_project_idx" ON "tl_sprint" USING btree ("project_id","start_on");--> statement-breakpoint
CREATE UNIQUE INDEX "tl_sprint_one_active" ON "tl_sprint" USING btree ("project_id") WHERE "tl_sprint"."state" = 'active';--> statement-breakpoint
ALTER TABLE "tl_task" ADD CONSTRAINT "tl_task_sprint_id_tl_sprint_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."tl_sprint"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tl_task_sprint_idx" ON "tl_task" USING btree ("sprint_id");--> statement-breakpoint
ALTER TABLE "tl_task" ADD CONSTRAINT "tl_task_points_valid" CHECK ("tl_task"."points" between 0 and 100);