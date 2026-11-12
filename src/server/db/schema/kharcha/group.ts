import { sql } from "drizzle-orm";
import { check, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { GroupIcon, GroupKind, GroupRole, GroupSettings, KharchaColor } from "@/features/kharcha/types";
import { khPerson } from "./person";

/**
 * Kharcha's groups (docs/guides/kharcha.md, decision 0277): a trip, a flat, a couple.
 * Its expenses and payments keep their own balances, per currency. Members are people, so
 * a group can hold someone without an account.
 */
export const khGroup = pgTable(
	"kh_group",
	{
		id: uuid().primaryKey().defaultRandom(),
		name: text().notNull(),
		kind: text().$type<GroupKind>().notNull().default("other"),
		color: text().$type<KharchaColor>().notNull(),
		icon: text().$type<GroupIcon>().notNull(),
		/** The currency a new expense starts in; an expense may be in any other. */
		currency: text().notNull(),
		/** The default split and whether debts are simplified: only what was changed. */
		settings: jsonb().$type<GroupSettings>().notNull().default({}),
		/** A trip's dates. */
		startOn: date({ mode: "string" }),
		endOn: date({ mode: "string" }),
		createdBy: uuid()
			.notNull()
			.references(() => khPerson.id),
		archivedAt: timestamp({ withTimezone: true }),
		/** Bumped by each save of the group's form: a stale save is refused. */
		version: integer().notNull().default(1),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("kh_group_created_by_idx").on(table.createdBy),
		check("kh_group_kind_valid", sql`${table.kind} in ('trip', 'home', 'couple', 'event', 'other')`),
		check(
			"kh_group_dates_ordered",
			sql`${table.startOn} is null or ${table.endOn} is null or ${table.startOn} <= ${table.endOn}`,
		),
	],
);

/**
 * A group's members. Leaving or being removed needs a zero balance in the group and sets
 * `left_at`: the row stays, so a former member keeps the history up to then, read only,
 * and can be added back.
 */
export const khGroupMember = pgTable(
	"kh_group_member",
	{
		groupId: uuid()
			.notNull()
			.references(() => khGroup.id, { onDelete: "cascade" }),
		personId: uuid()
			.notNull()
			.references(() => khPerson.id),
		role: text().$type<GroupRole>().notNull().default("member"),
		joinedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		leftAt: timestamp({ withTimezone: true }),
	},
	(table) => [
		primaryKey({ columns: [table.groupId, table.personId] }),
		index("kh_group_member_person_idx").on(table.personId),
		check("kh_group_member_role_valid", sql`${table.role} in ('owner', 'member')`),
	],
);

export type KhGroupRow = typeof khGroup.$inferSelect;
export type KhGroupMemberRow = typeof khGroupMember.$inferSelect;
