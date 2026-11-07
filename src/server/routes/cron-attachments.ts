/**
 * GET /api/cron/attachments: deletes removed attachments and day-old orphan
 * uploads from Cloudinary, then their rows (src/server/attachments/service.ts).
 *
 * Called by Vercel Cron (vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
 * Without CRON_SECRET configured the route doesn't exist (404); a wrong token is
 * 401. Safe to run any time and repeatedly.
 */
import { timingSafeEqual } from "node:crypto";
import { defineHandler } from "nitro";
import { cleanup } from "../attachments/service";
import { imageStore } from "../attachments/store";
import { db } from "../db/client";
import { serverEnv } from "../env";

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
	const result = await cleanup(db, imageStore);
	return json(200, { ok: true, ...result });
});
