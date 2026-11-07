import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import type { PartyPageData } from "@/features/parda/party/types";
import { PARDA_BANDS, PARDA_REPORT_KINDS } from "@/features/parda/player/playback";
import type { WatchPageData } from "@/features/parda/player/watch-types";
import { PARDA_TYPES, titleParamsSchema } from "@/features/parda/search";
import { zodInput } from "@/functions/_lib/validator";
import { withPardaCatalog } from "@/middleware/parda";
import { locales } from "@/paraglide/runtime";
import { db } from "@/server/db/client";
import { partyPage } from "@/server/parda/party/service";
import { partyRealtime } from "@/server/parda/party/token";
import { failureClient, limitPlayback, viewerDayKey, viewerKind } from "@/server/parda/player/limits";
import { recordPlay, reportProblem } from "@/server/parda/player/plays";
import { noteTitleFailure } from "@/server/parda/player/stats";
import { watchPage } from "@/server/parda/player/watch";
import { browsingProfile, PROFILE_COOKIE } from "@/server/parda/profiles/service";

/**
 * The watch page's functions (PLAN 12.5, decision 0236): open to everyone, like the
 * catalogue, each starting with `withPardaCatalog` (takedowns and the kill switch apply).
 * A playback's measurements and *Report a problem* are writes a visitor without a
 * session can make, so both are rate limited per user or IP.
 */

const locale = z.enum(locales);
const episodeNumber = z.number().int().min(0).max(9_999);
const media = z.enum(["movie", "tv"]);
const playbackId = z.uuid();

const watchInput = titleParamsSchema
	.extend({ season: episodeNumber.optional(), episode: episodeNumber.min(1).max(99_999).optional(), locale })
	.strict();

const playInput = z.strictObject({
	playbackId,
	sourceId: z.uuid(),
	media,
	id: titleParamsSchema.shape.id,
	season: episodeNumber.optional(),
	episode: episodeNumber.min(1).max(99_999).optional(),
	failed: z.boolean(),
	failReason: z.string().max(200).optional(),
	startMs: z.number().int().min(0).max(600_000).nullable(),
	stallCount: z.number().int().min(0).max(10_000),
	stallMs: z.number().int().min(0).max(86_400_000),
	watchedS: z.number().int().min(0).max(86_400),
	switchedAway: z.boolean(),
	band: z.enum(PARDA_BANDS),
	inParty: z.boolean().optional(),
});

const reportInput = z.strictObject({
	kind: z.enum(PARDA_REPORT_KINDS),
	media,
	id: titleParamsSchema.shape.id,
	season: episodeNumber.optional(),
	episode: episodeNumber.min(1).max(99_999).optional(),
	sourceId: z.uuid().nullable(),
	note: z.string().max(1_000),
});

export const getPardaWatch = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(watchInput))
	.handler(async ({ data, context }): Promise<WatchPageData> => {
		if (!context.catalog) return { configured: false };
		const profile = await browsingProfile(db, context.session, getCookie(PROFILE_COOKIE));
		return watchPage(
			context.catalog,
			db,
			{ media: PARDA_TYPES[data.type], id: data.id, season: data.season, episode: data.episode },
			{
				profileId: profile?.id ?? null,
				autoplay: profile?.autoplay ?? true,
				audioLanguage: profile?.audioLanguage ?? null,
			},
			data.locale,
		);
	});

/**
 * A party's page (Task 69a, decision 0243), for anyone holding its link: what's playing, in
 * the viewer's language and under their cap. Joining is `joinPardaParty`, which needs a session.
 */
export const getPardaParty = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(z.strictObject({ code: z.string().regex(/^[\w-]{16}$/), locale })))
	.handler(async ({ data, context }): Promise<PartyPageData> => {
		if (!context.catalog) return { configured: false };
		const profile = await browsingProfile(db, context.session, getCookie(PROFILE_COOKIE));
		return partyPage(
			context.catalog,
			db,
			partyRealtime(),
			data.code,
			{
				profileId: profile?.id ?? null,
				autoplay: profile?.autoplay ?? true,
				audioLanguage: profile?.audioLanguage ?? null,
			},
			data.locale,
		);
	});

/**
 * A playback's measurements (`pd_play`), sent as it starts, fails, is left or ends. A
 * playback that has just failed also counts against its source on this title (decision
 * 0238), within its own limit; past it, the failure still counts in the daily rollup.
 */
export const recordPardaPlay = createServerFn({ method: "POST" })
	.middleware([withPardaCatalog])
	.validator(zodInput(playInput))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		if (!context.catalog) return { ok: true };
		await limitPlayback(context.session, "play");
		const { failedNow, sourceId } = await recordPlay(
			db,
			context.catalog.services.controls,
			viewerKind(context.session),
			data,
			viewerDayKey(context.session),
		);
		if (failedNow && sourceId) {
			const client = await failureClient(context.session);
			if (client) await noteTitleFailure(db, { sourceId, media: data.media, tmdbId: data.id }, client);
		}
		return { ok: true };
	});

/** *Report a problem*, with the `ads` kind among the rest. */
export const reportPardaProblem = createServerFn({ method: "POST" })
	.middleware([withPardaCatalog])
	.validator(zodInput(reportInput))
	.handler(async ({ data, context }): Promise<{ id: string }> => {
		if (!context.catalog) return { id: "" };
		await limitPlayback(context.session, "report");
		return reportProblem(db, context.catalog.services.controls, context.session?.user.id ?? null, data);
	});
