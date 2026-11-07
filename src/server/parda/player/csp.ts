import "@tanstack/react-start/server-only";
import { originOf } from "@/lib/http/csp";
import { serverEnv } from "@/server/env";
import { errorFields, log } from "@/server/log";
import type { PardaSourceRow } from "../controls";
import { pardaControls } from "../tmdb/store";
import { embedOrigins, TRAILER_ORIGIN } from "./sources";

const TRAILER_THUMBNAILS = "https://i.ytimg.com";

/** Where the realtime SDK connects: its main endpoint and its fallback hosts (ably-js 2, decision 0243). */
const REALTIME_HOSTS = [
	"https://main.realtime.ably.net",
	"wss://main.realtime.ably.net",
	"https://*.ably-realtime.com",
	"wss://*.ably-realtime.com",
];

/** Watch parties' hosts, only with PARDA_REALTIME_KEY; the e2e stand-in instead when it's set. */
const realtimeOrigins = () => {
	if (!serverEnv.PARDA_REALTIME_KEY) return [];
	const relay = serverEnv.PARDA_REALTIME_URL;
	return relay ? [new URL(relay).origin] : REALTIME_HOSTS;
};

/**
 * The CSP additions of Parda's pages (decision 0230), from the sources cached for 30 s.
 * A failed read frames only trailers: a page must not fail over its headers.
 */
export async function pardaCspOrigins(options: { includeDisabled: boolean }) {
	const imageOrigin = originOf(serverEnv.TMDB_IMAGE_BASE);
	const img = [TRAILER_THUMBNAILS, ...(imageOrigin ? [imageOrigin] : [])];
	const connect = realtimeOrigins();
	let sources: PardaSourceRow[];
	try {
		sources = await pardaControls.sources();
	} catch (error) {
		log("error", "parda sources unavailable for the CSP", errorFields(error));
		return { embed: [TRAILER_ORIGIN], img, connect };
	}
	return { embed: embedOrigins(sources, { ...options, base: serverEnv.PARDA_PLAYER_BASE }), img, connect };
}
