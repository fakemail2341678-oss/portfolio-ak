import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Db } from "@/server/db/types";

/**
 * Ownership in the showcase apps (decision 0187): every app table has `owner_id`, and
 * every read and write is scoped by it, so a user (or guest) only ever sees and
 * changes their own rows. A row of someone else's is "not found", never "forbidden":
 * the answer doesn't tell whether it exists.
 */
type Owned = PgTable & { ownerId: PgColumn };

/** The condition every query of an app's repository includes (and its claim moves rows by). */
export const ownedBy = (table: Owned, userId: string) => eq(table.ownerId, userId);

/**
 * What an app's service works with: the database and who is asking (from
 * `requireAppUser`). Guests and accounts alike; `isGuest` only decides what can be
 * published (0186). Tests pass their own.
 */
export type AppServices = { db: Db; user: { id: string; isGuest: boolean } };
