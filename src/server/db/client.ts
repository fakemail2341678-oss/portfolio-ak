/**
 * Server-only Drizzle client over node-postgres (TCP), per Neon's guidance for
 * Vercel Fluid compute and long-running Node servers. See docs/decisions.md.
 */
import "@tanstack/react-start/server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { serverEnv } from "../env";
import { withVerifiedSsl } from "./connection-string";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema> & { $client: Pool };

const createPool = () =>
	new Pool({
		connectionString: withVerifiedSsl(serverEnv.DATABASE_URL),
		// Neon's PgBouncer (the -pooler host) does the real pooling. Keep the client pool small.
		max: 5,
		// Production closes idle connections quickly (serverless). In dev a remote database is a
		// long TLS handshake away, so connections are kept for a few minutes between requests.
		idleTimeoutMillis: process.env.NODE_ENV === "production" ? 10_000 : 300_000,
		connectionTimeoutMillis: 10_000,
	});

// Reuse one pool across dev hot reloads instead of leaking a new pool per edit.
const globalForDb = globalThis as typeof globalThis & { __appDbPool?: Pool };
const pool = globalForDb.__appDbPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__appDbPool = pool;

// On Vercel Fluid, keeps the function alive until idle connections close. No-op elsewhere.
attachDatabasePool(pool);

export const db: Database = drizzle({ client: pool, schema, casing: "snake_case" });
