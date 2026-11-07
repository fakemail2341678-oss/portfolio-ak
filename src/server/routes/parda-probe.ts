/**
 * GET and POST /api/parda/probe: Parda's daily source probe (src/server/parda/player/probe.ts,
 * decision 0238). `scripts/probe-sources.ts` reads what to probe and posts what it saw, with
 * `Authorization: Bearer <PARDA_PROBE_SECRET>`. Without PARDA_PROBE_SECRET the route is a 404;
 * a wrong token is a 401.
 */
import { defineHandler } from "nitro";
import { db } from "../db/client";
import { serverEnv } from "../env";
import { log } from "../log";
import { handleProbe } from "../parda/player/probe";
import { pardaControls } from "../parda/tmdb/store";

export default defineHandler(async (event) => {
	const response = await handleProbe(event.req, {
		db,
		controls: pardaControls,
		secret: serverEnv.PARDA_PROBE_SECRET,
		base: serverEnv.PARDA_PLAYER_BASE,
	});
	if (event.req.method === "POST" && response.ok) log("info", "parda probe stored", await response.clone().json());
	return response;
});
