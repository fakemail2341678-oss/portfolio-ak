/**
 * GET /api/cron/guests: deletes guests (decision 0185) created more than seven days
 * ago, with their app rows (foreign keys cascade) and their uploads, deleted from
 * Cloudinary through the attachments service (src/server/guests/service.ts).
 *
 * Called by Vercel Cron (vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
 * Without CRON_SECRET configured the route doesn't exist (404); a wrong token is
 * 401 (`defineCron`, src/server/http/cron.ts). Safe to run any time and repeatedly.
 */
import { imageStore } from "../attachments/store";
import { db } from "../db/client";
import { deleteExpiredGuests } from "../guests/service";
import { defineCron } from "../http/cron";

export default defineCron({
	name: "guests",
	steps: () => ({ guests: () => deleteExpiredGuests(db, imageStore) }),
}).nitro;
