import { sql } from "drizzle-orm";
import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { TEST_CRUD_STATUSES } from "../../../features/test-crud/constants";
import { user } from "./auth";

export const testCrudStatus = pgEnum("test_crud_status", TEST_CRUD_STATUSES);

/** The reference feature's table. Columns are listed in docs/PLAN.md (Phase 9a). */
export const testCrud = pgTable(
	"test_crud",
	{
		id: uuid().primaryKey().defaultRandom(),
		slug: text().notNull().unique(),
		title: text().notNull(),
		summary: text().notNull().default(""),
		/** Sanitized HTML (sanitizeRichText) — never stored raw. */
		body: text().notNull().default(""),
		status: testCrudStatus().notNull().default("draft"),
		/** NPR, two decimals. */
		price: numeric({ precision: 12, scale: 2, mode: "number" }).notNull().default(0),
		/** E.164 or null. */
		phone: text(),
		tags: text().array().notNull().default(sql`'{}'::text[]`),
		publishedAt: timestamp({ withTimezone: true }),
		createdBy: text().references(() => user.id, { onDelete: "set null" }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("test_crud_status_published_idx").on(table.status, table.publishedAt),
		index("test_crud_updated_idx").on(table.updatedAt),
		// List filters: tags (any of, `&&`) and price range.
		index("test_crud_tags_idx").using("gin", table.tags),
		index("test_crud_price_idx").on(table.price),
	],
);

export type TestCrudRow = typeof testCrud.$inferSelect;
export type NewTestCrudRow = typeof testCrud.$inferInsert;
