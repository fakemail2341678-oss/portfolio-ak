import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type { StoredProjectSettings } from "../../../../features/taskline/settings";
import type {
	ProjectHealth,
	ProjectRole,
	ProjectStatus,
	ProjectVisibility,
	StatusCategory,
	TasklineColor,
} from "../../../../features/taskline/types";
import { tlMember, tlWorkspace } from "./workspace";

/**
 * Projects, who is on them, and their workflow (statuses, labels). Order keys
 * (`position`) are fractional (src/lib/fractional-index.ts), compared with COLLATE "C".
 */

const timestamps = () => ({
	createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const tlProject = pgTable(
	"tl_project",
	{
		id: uuid().primaryKey().defaultRandom(),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		/** 2–6 of A-Z and 0-9, a letter first; task refs are `KEY-12`. Never changes. */
		key: text().notNull(),
		name: text().notNull(),
		descriptionHtml: text().notNull().default(""),
		descriptionText: text().notNull().default(""),
		color: text().$type<TasklineColor>().notNull().default("blue"),
		icon: text().notNull().default(""),
		visibility: text().$type<ProjectVisibility>().notNull().default("team"),
		status: text().$type<ProjectStatus>().notNull().default("active"),
		health: text().$type<ProjectHealth>(),
		leadId: uuid().references(() => tlMember.id, { onDelete: "set null" }),
		startOn: date({ mode: "string" }),
		targetOn: date({ mode: "string" }),
		settings: jsonb().$type<StoredProjectSettings>().notNull().default({}),
		/** The last task number handed out (under this row's lock). */
		taskSeq: integer().notNull().default(0),
		/** Bumped by every change to the project or its tasks: what open pages poll (Task 48). */
		rev: bigint({ mode: "number" }).notNull().default(0),
		/** Bumped by each save of the project form (name, description, dates, settings): a stale save is refused. */
		version: integer().notNull().default(1),
		archivedAt: timestamp({ withTimezone: true }),
		...timestamps(),
	},
	(table) => [
		uniqueIndex("tl_project_key_unique").on(table.workspaceId, table.key),
		check("tl_project_key_valid", sql`${table.key} ~ '^[A-Z][A-Z0-9]{1,5}$'`),
		check("tl_project_visibility_valid", sql`${table.visibility} in ('team', 'private')`),
		check("tl_project_status_valid", sql`${table.status} in ('active', 'paused', 'completed', 'archived')`),
		check("tl_project_health_valid", sql`${table.health} in ('on_track', 'at_risk', 'off_track')`),
	],
);

export const tlProjectMember = pgTable(
	"tl_project_member",
	{
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		memberId: uuid()
			.notNull()
			.references(() => tlMember.id, { onDelete: "cascade" }),
		role: text().$type<ProjectRole>().notNull().default("member"),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.projectId, table.memberId] }),
		index("tl_project_member_member_idx").on(table.memberId),
		check("tl_project_member_role_valid", sql`${table.role} in ('lead', 'member', 'viewer')`),
	],
);

export const tlStar = pgTable(
	"tl_star",
	{
		memberId: uuid()
			.notNull()
			.references(() => tlMember.id, { onDelete: "cascade" }),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [primaryKey({ columns: [table.memberId, table.projectId] })],
);

export const tlStatus = pgTable(
	"tl_status",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => tlProject.id, { onDelete: "cascade" }),
		name: text().notNull(),
		category: text().$type<StatusCategory>().notNull(),
		color: text().$type<TasklineColor>().notNull().default("gray"),
		position: text().notNull(),
		wipLimit: integer(),
		...timestamps(),
	},
	(table) => [
		index("tl_status_project_idx").on(table.projectId, table.position),
		check(
			"tl_status_category_valid",
			sql`${table.category} in ('backlog', 'unstarted', 'started', 'completed', 'canceled')`,
		),
		check("tl_status_wip_positive", sql`${table.wipLimit} > 0`),
	],
);

export const tlLabel = pgTable(
	"tl_label",
	{
		id: uuid().primaryKey().defaultRandom(),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		/** Null: a workspace-wide label (the admin's, Task 49). */
		projectId: uuid().references(() => tlProject.id, { onDelete: "cascade" }),
		name: text().notNull(),
		color: text().$type<TasklineColor>().notNull().default("gray"),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		// A name once per scope, in any case.
		uniqueIndex("tl_label_workspace_name_unique")
			.on(table.workspaceId, sql`lower(${table.name})`)
			.where(sql`${table.projectId} is null`),
		uniqueIndex("tl_label_project_name_unique")
			.on(table.projectId, sql`lower(${table.name})`)
			.where(sql`${table.projectId} is not null`),
	],
);

/**
 * A project's key, kept once the project is deleted: task refs (`WEB-12`) live on in
 * comments, emails and links, so a key is never handed out again (Task 49).
 */
export const tlRetiredKey = pgTable(
	"tl_retired_key",
	{
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		key: text().notNull(),
		retiredAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [primaryKey({ columns: [table.workspaceId, table.key] })],
);

/**
 * An invitation to the team by email (Task 49, decision 0212): accepted by signing in
 * with that address once it is verified, which makes the account a member (and puts
 * it on `project_id`, when set). Revoked and accepted ones stay, as the record.
 */
export const tlInvitation = pgTable(
	"tl_invitation",
	{
		id: uuid().primaryKey().defaultRandom(),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		/** Lowercase. */
		email: text().notNull(),
		role: text().$type<"member" | "viewer">().notNull().default("member"),
		invitedById: uuid().references(() => tlMember.id, { onDelete: "set null" }),
		/** The project they join with it, if any. */
		projectId: uuid().references(() => tlProject.id, { onDelete: "set null" }),
		expiresAt: timestamp({ withTimezone: true }).notNull(),
		acceptedAt: timestamp({ withTimezone: true }),
		revokedAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("tl_invitation_email_idx").on(table.workspaceId, table.email),
		uniqueIndex("tl_invitation_pending_unique")
			.on(table.workspaceId, table.email)
			.where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
		check("tl_invitation_email_lowercase", sql`${table.email} = lower(${table.email})`),
	],
);

export type TlProjectRow = typeof tlProject.$inferSelect;
export type TlInvitationRow = typeof tlInvitation.$inferSelect;
export type TlStatusRow = typeof tlStatus.$inferSelect;
export type TlLabelRow = typeof tlLabel.$inferSelect;
