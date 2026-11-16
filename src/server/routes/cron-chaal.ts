/**
 * GET /api/cron/chaal: Chaal's daily job (src/server/chaal/cron.ts). One step: its
 * rollup must finish before its prunes run, so they succeed or fail together.
 *
 * Called by Vercel Cron (vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
 * Without CRON_SECRET configured the route doesn't exist (404); a wrong token is 401
 * (`defineCron`, src/server/http/cron.ts).
 */
import { runChaalCron } from "../chaal/cron";
import { db } from "../db/client";
import { defineCron } from "../http/cron";

export default defineCron({ name: "chaal", steps: () => ({ daily: () => runChaalCron(db) }) }).nitro;
