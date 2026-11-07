import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type {
	AutomationAction,
	AutomationCondition,
	AutomationOutcome,
	AutomationRunDetail,
	AutomationTrigger,
} from "../../../../features/taskline/types";
import { tlProject } from "./project";
import { tlTask } from "./task";
import { tlMember, tlWorkspace } from "./workspace";

/**
 * Automations (Task 56, decision 0221): the workspace's (`project_id` null, the
 * admin's) or a project's (its lead's). A trigger, conditions and actions as jsonb,
 * checked against `automationDefinition` (features/taskline/automation-rules.ts) and
 * the scope's statuses, labels, members and fields when saved. They run in the
 * transaction of the change that triggers them, each inside its own savepoint.
 */
export const tlAutomation = pgTable(
	"tl_automation",
	{
		id: uuid().primaryKey().defaultRandom(),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		/** Null: a workspace rule, on every team project's tasks. */
		projectId: uuid().references(() => tlProject.id, { onDelete: "cascade" }),
		name: text().notNull(),
		enabled: boolean().notNull().default(true),
		trigger: jsonb().$type<AutomationTrigger>().notNull(),
		conditions: jsonb().$type<AutomationCondition[]>().notNull().default([]),
		actions: jsonb().$type<AutomationAction[]>().notNull(),
		createdById: uuid().references(() => tlMember.id, { onDelete: "set null" }),
		/** Goes up when the builder's form saves (a stale save is refused); switching on and off doesn't. */
		version: integer().notNull().default(1),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("tl_automation_scope_idx").on(table.workspaceId, table.projectId),
		check("tl_automation_name_valid", sql`length(${table.name}) between 1 and 80`),
	],
);

/**
 * Each time an automation's trigger fired on a task: what came of it. `key` makes the
 * daily job's triggers once per task and due date (`due_soon:<task>:<day>`). The daily
 * job deletes runs older than 30 days.
 */
export const tlAutomationRun = pgTable(
	"tl_automation_run",
	{
		id: uuid().primaryKey().defaultRandom(),
		automationId: uuid()
			.notNull()
			.references(() => tlAutomation.id, { onDelete: "cascade" }),
		taskId: uuid().references(() => tlTask.id, { onDelete: "set null" }),
		outcome: text().$type<AutomationOutcome>().notNull(),
		detail: jsonb().$type<AutomationRunDetail>().notNull().default({}),
		key: text(),
		at: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("tl_automation_run_automation_idx").on(table.automationId, table.at.desc()),
		index("tl_automation_run_at_idx").on(table.at),
		uniqueIndex("tl_automation_run_key_unique").on(table.automationId, table.key).where(sql`${table.key} is not null`),
		check("tl_automation_run_outcome_valid", sql`${table.outcome} in ('ok', 'skipped', 'failed')`),
	],
);

export type TlAutomationRow = typeof tlAutomation.$inferSelect;
export type TlAutomationRunRow = typeof tlAutomationRun.$inferSelect;
