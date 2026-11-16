/**
 * GET /api/cron/parda: Parda's daily job (src/server/parda/cron.ts).
 *
 * Called by Vercel Cron (vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
 * Without CRON_SECRET configured the route doesn't exist (404); a wrong token is 401
 * (`defineCron`, src/server/http/cron.ts).
 */
import { db } from "../db/client";
import { defineCron } from "../http/cron";
import { pardaCronSteps } from "../parda/cron";
import { pardaControls, pardaTmdb } from "../parda/tmdb/store";

export default defineCron({
	name: "parda",
	steps: () => pardaCronSteps(db, pardaTmdb, { onRanked: pardaControls.invalidate, controls: pardaControls }),
}).nitro;
