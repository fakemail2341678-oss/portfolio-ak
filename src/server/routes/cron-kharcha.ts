/**
 * GET /api/cron/kharcha: Kharcha's daily job (decision 0286): the digests, purging the
 * trash past 30 days, expiring invites and pruning read notifications
 * (src/server/kharcha/cron.ts). Every step is idempotent.
 *
 * Called by Vercel Cron (vercel.json, 01:30 UTC: 07:15 in Kathmandu) with
 * `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET configured the route
 * doesn't exist (404); a wrong token is 401.
 */
import { timingSafeEqual } from "node:crypto";
import { defineHandler } from "nitro";
import { db } from "../db/client";
import { serverEnv } from "../env";
import { runKharchaCron } from "../kharcha/cron";
import { log } from "../log";

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", "cache-control": "no-store" },
	});

const authorized = (header: string | null, secret: string) => {
	const expected = Buffer.from(`Bearer ${secret}`);
	const given = Buffer.from(header ?? "");
	return given.length === expected.length && timingSafeEqual(given, expected);
};

export default defineHandler(async (event) => {
	const secret = serverEnv.CRON_SECRET;
	if (!secret) return json(404, { error: "Not found" });
	if (!authorized(event.req.headers.get("authorization"), secret)) return json(401, { error: "Unauthorized" });
	const result = await runKharchaCron(db);
	log("info", "kharcha daily job", result);
	return json(200, { ok: true, ...result });
});
