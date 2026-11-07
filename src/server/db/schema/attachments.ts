import { bigint, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { EMPTY_LOCALIZED, localizedText } from "./columns";

/**
 * Files stored in Cloudinary (docs/decisions.md 0098). A row exists only for an
 * upload the server has verified with Cloudinary's Admin API.
 *
 * Lifecycle:
 * - pending: uploaded and verified, not yet saved with an entity (`entity_type` null).
 *   Pending rows older than a day are orphans: the cleanup job deletes them.
 * - linked: belongs to an entity (`entity_type` + `entity_id`), ordered by `position`.
 * - removed: `deleted_at` set when the entity drops it or is deleted; the cleanup
 *   job (or the request itself, when Cloudinary answers) deletes the asset, then the row.
 */
export const attachment = pgTable(
	"attachment",
	{
		id: uuid().primaryKey().defaultRandom(),
		/** Cloudinary public_id (folder path included), unique per asset. */
		publicId: text().notNull().unique(),
		/** Cloudinary's version, part of delivery URLs (cache-busting). */
		version: bigint({ mode: "number" }).notNull(),
		resourceType: text().notNull().default("image"),
		format: text().notNull(),
		bytes: integer().notNull(),
		width: integer(),
		height: integer(),
		/** Alt text in both languages (0177); empty English means decorative or not described yet. */
		alt: localizedText().notNull().default(EMPTY_LOCALIZED),
		ownerId: text().references(() => user.id, { onDelete: "set null" }),
		/** What it belongs to ("test-crud", or "media" for the media library) and which row; null while pending. */
		entityType: text(),
		entityId: text(),
		position: integer().notNull().default(0),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		deletedAt: timestamp({ withTimezone: true }),
	},
	(table) => [
		index("attachment_entity_idx").on(table.entityType, table.entityId, table.position),
		index("attachment_cleanup_idx").on(table.deletedAt, table.entityType, table.createdAt),
	],
);

export type AttachmentRow = typeof attachment.$inferSelect;
