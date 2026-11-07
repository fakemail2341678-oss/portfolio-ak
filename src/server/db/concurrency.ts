import "@tanstack/react-start/server-only";
import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * True while `column` still holds `version`, the ISO `updatedAt` the client
 * started from (src/lib/concurrency.ts). Compared at millisecond precision:
 * Postgres keeps microseconds (`defaultNow()` on insert) but a JS Date, and so
 * the version the client got, keeps milliseconds.
 *
 * Columns without a time zone (Better Auth's tables) hold UTC wall-clock time
 * (how Drizzle writes and reads them), so the version is compared in UTC there,
 * whatever the connection's time zone.
 */
export const sameVersion = (column: AnyPgColumn, version: string): SQL<boolean> =>
	column.getSQLType().includes("with time zone")
		? sql<boolean>`date_trunc('milliseconds', ${column}) = ${version}::timestamptz`
		: sql<boolean>`date_trunc('milliseconds', ${column}) = (${version}::timestamptz at time zone 'UTC')`;
