import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type { CategoryIconName, KharchaColor, RuleMatch } from "@/features/kharcha/types";
import { khPerson } from "./person";

/**
 * A person's own lists (docs/guides/kharcha.md "Lists", Task 89): categories, tags, payment
 * methods and merchant rules. Each belongs to one person and nobody else sees it; on a
 * shared expense every participant's share carries their own category and tags, and every
 * payer their own method (PLAN 14.5 "Access").
 */

/**
 * A category. The built-ins (`key`, from `kh_settings`' defaults) are made with the
 * person's first use, named in the language they used then; renaming one keeps its key, so
 * a participant's share can default to their own category of the same key (Task 90).
 * Deleting one leaves its shares uncategorized (`set null`); archiving hides it from the
 * pickers and keeps it on what it was used for.
 */
export const khCategory = pgTable(
	"kh_category",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		key: text(),
		name: text().notNull(),
		color: text().$type<KharchaColor>().notNull(),
		icon: text().$type<CategoryIconName>().notNull(),
		position: integer().notNull().default(0),
		archivedAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("kh_category_name_unique").on(table.ownerId, sql`lower(${table.name})`),
		uniqueIndex("kh_category_key_unique").on(table.ownerId, table.key).where(sql`${table.key} is not null`),
		index("kh_category_owner_idx").on(table.ownerId, table.position),
	],
);

export const khTag = pgTable(
	"kh_tag",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		name: text().notNull(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("kh_tag_name_unique").on(table.ownerId, sql`lower(${table.name})`)],
);

/** How a payer paid (Cash, eSewa, Khalti, a card): a label only, no money moves through Kharcha. */
export const khMethod = pgTable(
	"kh_method",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		name: text().notNull(),
		position: integer().notNull().default(0),
		archivedAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("kh_method_name_unique").on(table.ownerId, sql`lower(${table.name})`),
		index("kh_method_owner_idx").on(table.ownerId, table.position),
	],
);

/**
 * A merchant rule (Settings → Rules): when a new expense's merchant matches (`contains` or
 * `equals`, in any case), its category, tags and method start as the rule says. Rules are
 * tried in `position` order and the first match wins. `tag_ids` has no foreign key: a tag
 * deleted since is skipped when the rule is read.
 */
export const khMerchantRule = pgTable(
	"kh_merchant_rule",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		match: text().$type<RuleMatch>().notNull().default("contains"),
		pattern: text().notNull(),
		categoryId: uuid().references((): AnyPgColumn => khCategory.id, { onDelete: "set null" }),
		tagIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
		methodId: uuid().references((): AnyPgColumn => khMethod.id, { onDelete: "set null" }),
		position: integer().notNull().default(0),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("kh_merchant_rule_owner_idx").on(table.ownerId, table.position),
		check("kh_merchant_rule_match_valid", sql`${table.match} in ('contains', 'equals')`),
	],
);

/**
 * A receipt uploaded before its details (Task 89): "upload now, add the details later". Its
 * files are attachments (`entity_type` `kh_receipt_draft`); Home lists it as a to-do, and
 * the expense made from it takes its files and replaces it.
 */
export const khReceiptDraft = pgTable(
	"kh_receipt_draft",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: uuid()
			.notNull()
			.references(() => khPerson.id, { onDelete: "cascade" }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("kh_receipt_draft_owner_idx").on(table.ownerId, table.createdAt)],
);

export type KhCategoryRow = typeof khCategory.$inferSelect;
export type KhTagRow = typeof khTag.$inferSelect;
export type KhMethodRow = typeof khMethod.$inferSelect;
export type KhMerchantRuleRow = typeof khMerchantRule.$inferSelect;
export type KhReceiptDraftRow = typeof khReceiptDraft.$inferSelect;
