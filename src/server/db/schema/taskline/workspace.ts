import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { StoredWorkspaceSettings } from "../../../../features/taskline/settings";
import type { NotifyMode } from "../../../../features/taskline/types";
import { user } from "../auth";

/**
 * Taskline's tenancy (docs/guides/taskline.md, decision 0203): one `team` workspace,
 * run from /admin, and a `sandbox` per user. Members are the identity everything
 * else points at (assignee, author, actor), so history keeps a name when an account goes.
 */

export const tlWorkspace = pgTable(
	"tl_workspace",
	{
		id: uuid().primaryKey().defaultRandom(),
		kind: text().$type<"team" | "sandbox">().notNull(),
		/** The team's URL segment (a setting); every sandbox is reached as `sandbox`. */
		slug: text().notNull(),
		name: text().notNull(),
		/** A sandbox's owner (deleted with them); null for the team. */
		ownerId: text().references(() => user.id, { onDelete: "cascade" }),
		settings: jsonb().$type<StoredWorkspaceSettings>().notNull().default({}),
		/** Bumped by each save of the settings form: a stale save is refused. */
		version: integer().notNull().default(1),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("tl_workspace_one_team").on(table.kind).where(sql`${table.kind} = 'team'`),
		uniqueIndex("tl_workspace_owner_unique").on(table.ownerId),
		check("tl_workspace_kind_valid", sql`${table.kind} in ('team', 'sandbox')`),
		check("tl_workspace_owner_matches_kind", sql`(${table.kind} = 'team') = (${table.ownerId} is null)`),
	],
);

export const tlMember = pgTable(
	"tl_member",
	{
		id: uuid().primaryKey().defaultRandom(),
		workspaceId: uuid()
			.notNull()
			.references(() => tlWorkspace.id, { onDelete: "cascade" }),
		/** Null for a sandbox's placeholder teammates, and once the account is deleted. */
		userId: text().references(() => user.id, { onDelete: "set null" }),
		/** The name history shows: a snapshot of the account's, kept when it goes. */
		displayName: text().notNull(),
		role: text().$type<"member" | "viewer">().notNull().default("member"),
		title: text().notNull().default(""),
		capacityMinutesWeek: integer().notNull().default(2400),
		/** Per notification kind, overrides of the workspace's defaults (Task 50). */
		notify: jsonb().$type<Partial<Record<string, NotifyMode>>>().notNull().default({}),
		/** The language of their emails (Task 50); null: the app's base language. */
		locale: text(),
		deactivatedAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("tl_member_workspace_user_unique").on(table.workspaceId, table.userId),
		index("tl_member_user_idx").on(table.userId),
		check("tl_member_role_valid", sql`${table.role} in ('member', 'viewer')`),
	],
);

export type TlWorkspaceRow = typeof tlWorkspace.$inferSelect;
export type TlMemberRow = typeof tlMember.$inferSelect;
