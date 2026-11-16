/**
 * GET /api/cron/kharcha: Kharcha's daily job (decision 0286): the digests, purging the
 * trash past 30 days, expiring invites and pruning read notifications
 * (src/server/kharcha/cron.ts). Every step is idempotent.
 *
 * Called by Vercel Cron (vercel.json, 01:30 UTC: 07:15 in Kathmandu) with
 * `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET configured the route
 * doesn't exist (404); a wrong token is 401 (`defineCron`, src/server/http/cron.ts).
 */
import { db } from "../db/client";
import { defineCron } from "../http/cron";
import { kharchaCronSteps } from "../kharcha/cron";

export default defineCron({ name: "kharcha", steps: () => kharchaCronSteps(db) }).nitro;
