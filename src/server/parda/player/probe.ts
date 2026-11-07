import "@tanstack/react-start/server-only";
import { timingSafeEqual } from "node:crypto";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { PardaSourceAdapter } from "@/features/parda/player/adapters/types";
import { type PardaMedia, pdSource, pdSourceProbe, pdTitle } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { type PardaControls, titleKey } from "../controls";
import { playerLanguage, playerUrl } from "./sources";

/**
 * `/api/parda/probe` (PLAN 12.5, "The daily probe"; decision 0238): `GET` tells
 * `scripts/probe-sources.ts` what to probe (each enabled source, filled for the most
 * popular movie, series and anime), `POST` stores what it saw. Both need
 * `Authorization: Bearer <PARDA_PROBE_SECRET>`; without the secret the route is a 404.
 */

/** TMDB's Animation genre: Parda's anime hub is Japanese animation, and the snapshot keeps genres. */
const ANIMATION = 16;
const HOST = /^(?=.{1,253}$)[a-z0-9-]+(\.[a-z0-9-]+)*$/i;
const height = z.number().int().min(1).max(4320);

export const probeResult = z.strictObject({
	sourceId: z.uuid(),
	media: z.enum(["movie", "tv"]),
	tmdbId: z.number().int().positive().max(999_999_999),
	season: z.number().int().min(0).max(9_999).optional(),
	episode: z.number().int().min(1).max(99_999).optional(),
	alive: z.boolean(),
	startMs: z.number().int().min(0).max(600_000).nullable(),
	topHeight: height.nullable(),
	ladder: z.array(height).max(20),
	popups: z.number().int().min(0).max(1_000),
	clicks: z.number().int().min(0).max(1_000),
	redirects: z.number().int().min(0).max(1_000),
	videoHosts: z.array(z.string().regex(HOST)).max(20),
	error: z.string().max(200).nullable(),
});
export type ProbeResult = z.infer<typeof probeResult>;
export const probePayload = z.strictObject({ results: z.array(probeResult).min(1).max(200) });

export type ProbeTitle = { media: PardaMedia; id: number; season?: number; episode?: number; name: string };
export type ProbePlan = {
	titles: ProbeTitle[];
	sources: Array<{
		id: string;
		name: string;
		adapter: PardaSourceAdapter;
		needsClick: boolean;
		/** One per title, absolute, in `titles`' order; null where the source can't play it. */
		urls: Array<string | null>;
	}>;
};

/** The most popular title of a kind in the snapshot, past takedowns. */
async function mostPopular(
	db: Db,
	blocked: ReadonlySet<string>,
	media: PardaMedia,
	animated: boolean | null,
): Promise<ProbeTitle | null> {
	const rows = await db
		.select({ id: pdTitle.tmdbId, title: pdTitle.title })
		.from(pdTitle)
		.where(
			and(
				eq(pdTitle.media, media),
				isNotNull(pdTitle.popularityRank),
				animated === null
					? undefined
					: animated
						? sql`${pdTitle.genres} @> ${JSON.stringify([ANIMATION])}::jsonb`
						: sql`not (${pdTitle.genres} @> ${JSON.stringify([ANIMATION])}::jsonb)`,
			),
		)
		.orderBy(asc(pdTitle.popularityRank))
		.limit(10);
	const row = rows.find((each) => !blocked.has(titleKey(media, each.id)));
	if (!row) return null;
	return { media, id: row.id, ...(media === "tv" ? { season: 1, episode: 1 } : {}), name: row.title.en };
}

/** What to probe: nothing while playback is off (the kill switch covers the probe too). */
export async function probePlan(db: Db, controls: PardaControls, appOrigin: string, base?: string): Promise<ProbePlan> {
	const [settings, blocked] = await Promise.all([controls.settings(), controls.blocked()]);
	if (!settings.playbackEnabled) return { titles: [], sources: [] };
	const found = await Promise.all([
		mostPopular(db, blocked, "movie", null),
		mostPopular(db, blocked, "tv", false),
		mostPopular(db, blocked, "tv", true),
	]);
	const titles = found.filter((title): title is ProbeTitle => title !== null);
	const rows = await db.select().from(pdSource).where(eq(pdSource.enabled, true)).orderBy(asc(pdSource.position));
	const lang = playerLanguage("en", "languages" in settings ? settings.languages : undefined);
	return {
		titles,
		sources: rows.map((source) => ({
			id: source.id,
			name: source.name.en,
			adapter: source.adapter,
			needsClick: source.needsClick,
			urls: titles.map((title) => {
				const url = playerUrl(source, title, { lang, base, start: 0 });
				return url === null ? null : new URL(url, appOrigin).toString();
			}),
		})),
	};
}

/** Stores a run's results; rows naming a source that's gone are dropped. */
export async function storeProbe(
	db: Db,
	results: ReadonlyArray<ProbeResult>,
): Promise<{ stored: number; ignored: number }> {
	const known = new Set((await db.select({ id: pdSource.id }).from(pdSource)).map((row) => row.id));
	const rows = results
		.filter((result) => known.has(result.sourceId))
		.map((result) => ({
			sourceId: result.sourceId,
			media: result.media,
			tmdbId: result.tmdbId,
			season: result.media === "tv" ? (result.season ?? null) : null,
			episode: result.media === "tv" ? (result.episode ?? null) : null,
			alive: result.alive,
			startMs: result.startMs,
			topHeight: result.topHeight,
			ladder: [...new Set(result.ladder)].sort((a, b) => b - a),
			popups: result.popups,
			clicks: result.clicks,
			redirects: result.redirects,
			videoHosts: [...new Set(result.videoHosts.map((host) => host.toLowerCase()))],
			error: result.error,
		}));
	if (rows.length) await db.insert(pdSourceProbe).values(rows);
	return { stored: rows.length, ignored: results.length - rows.length };
}

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

export type ProbeDeps = {
	db: Db;
	controls: PardaControls;
	secret: string | undefined;
	/** Where relative templates point: PARDA_PLAYER_BASE, else this app's placeholder routes. */
	base?: string | undefined;
};

/** The route itself, as a function of the request, so tests call it without a server. */
export async function handleProbe(request: Request, deps: ProbeDeps): Promise<Response> {
	if (!deps.secret) return json(404, { error: "Not found" });
	if (!authorized(request.headers.get("authorization"), deps.secret)) return json(401, { error: "Unauthorized" });
	if (request.method === "GET") {
		return json(200, await probePlan(deps.db, deps.controls, new URL(request.url).origin, deps.base));
	}
	if (request.method !== "POST") return json(405, { error: "Method not allowed" });
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json(400, { error: "Invalid JSON" });
	}
	const parsed = probePayload.safeParse(body);
	if (!parsed.success) return json(400, { error: "Invalid payload", issues: parsed.error.issues.length });
	return json(200, { ok: true, ...(await storeProbe(deps.db, parsed.data.results)) });
}
