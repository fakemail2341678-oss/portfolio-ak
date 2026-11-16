/**
 * GET /api/cron/attachments: deletes removed attachments and day-old orphan
 * uploads from Cloudinary, then their rows (src/server/attachments/service.ts).
 *
 * Called by Vercel Cron (vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
 * Without CRON_SECRET configured the route doesn't exist (404); a wrong token is
 * 401 (`defineCron`, src/server/http/cron.ts). Safe to run any time and repeatedly.
 */
import { cleanup } from "../attachments/service";
import { imageStore } from "../attachments/store";
import { db } from "../db/client";
import { defineCron } from "../http/cron";

export default defineCron({
	name: "attachments",
	steps: () => ({ attachments: () => cleanup(db, imageStore) }),
}).nitro;
