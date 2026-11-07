#!/usr/bin/env node
/**
 * The portfolio's demo content (decision 0176): profile, projects, journal
 * posts, experience, skills, process steps and testimonials, so `/` has
 * something to show. Safe to run again: once a profile exists, nothing is
 * written (the content is then the owner's, edited in the admin).
 *
 *   pnpm db:seed-portfolio
 *
 * Run `pnpm db:migrate` first. `pnpm db:seed-demo`, `pnpm setup:local`,
 * `pnpm dev:local` and the e2e harness run it too. The content itself is in
 * ./lib/portfolio-data/.
 */
import { existsSync } from "node:fs";
import pg from "pg";
// A plain TypeScript module without imports: Node strips its types.
import { withVerifiedSsl } from "../src/server/db/connection-string.ts";
import { seedPortfolio } from "./lib/portfolio-seed.ts";

if (existsSync(".env")) process.loadEnvFile(".env");

if (!process.env.DATABASE_URL) {
	console.error("seed-portfolio: provide DATABASE_URL.");
	process.exit(1);
}

const client = new pg.Client({ connectionString: withVerifiedSsl(process.env.DATABASE_URL) });
await client.connect();
try {
	await client.query("begin");
	const { seeded } = await seedPortfolio((sql, params) => client.query(sql, params));
	await client.query("commit");
	console.log(seeded ? "seed-portfolio: demo content written." : "seed-portfolio: a profile exists; nothing written.");
} catch (error) {
	await client.query("rollback");
	console.error("seed-portfolio failed:", error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	await client.end();
}
