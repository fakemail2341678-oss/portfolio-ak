/**
 * GET /api/cron/taskline: Taskline's daily job (decision 0214): due and overdue
 * notices, the digests, purging the trash past retention and expiring invitations
 * (src/server/taskline/cron.ts). Every step is idempotent.
 *
 * Called by Vercel Cron (vercel.json, 01:15 UTC: 07:00 in Kathmandu) with
 * `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET configured the route
 * doesn't exist (404); a wrong token is 401 (`defineCron`, src/server/http/cron.ts).
 */
import { db } from "../db/client";
import { defineCron } from "../http/cron";
import { tasklineCronSteps } from "../taskline/cron";

export default defineCron({ name: "taskline", steps: () => tasklineCronSteps(db) }).nitro;
