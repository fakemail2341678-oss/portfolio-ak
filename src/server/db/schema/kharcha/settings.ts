import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";
import type { StoredKharchaSettings } from "@/features/kharcha/settings";

/**
 * Kharcha's controls (docs/guides/kharcha.md): one row. `settings` holds only what the
 * admin changed; the defaults are in code (src/features/kharcha/settings.ts), so a missing
 * row and `{}` both mean the defaults, and a new setting needs no migration. The admin
 * edits it on /admin/kharcha/settings (Task 96), saved with `version`.
 */
export const khSettings = pgTable(
	"kh_settings",
	{
		id: integer().primaryKey().default(1),
		settings: jsonb().$type<StoredKharchaSettings>().notNull().default({}),
		version: integer().notNull().default(1),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [check("kh_settings_one_row", sql`${table.id} = 1`)],
);
