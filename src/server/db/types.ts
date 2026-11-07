import "@tanstack/react-start/server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Any Drizzle Postgres database over the app schema: the Neon client in the app
 * (src/server/db/client.ts) and PGlite in tests (tests/utils/test-db.ts).
 * Repositories take it as their first argument instead of importing the client,
 * so the same code runs in both.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** The transaction handle passed to `db.transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
