import "@tanstack/react-start/server-only";
import { and, eq, sql } from "drizzle-orm";
import type { ChaalAdminSettings, ChaalSettingsInput } from "@/features/chaal/admin/schema";
import { readCommunityLimits } from "@/features/chaal/community/limits";
import { readEngineLimits } from "@/features/chaal/engine/limits";
import { CHAAL_FEATURES, type ChaalFeature, featureOn, isLichessScope } from "@/features/chaal/features";
import { readPlayLimits } from "@/features/chaal/play/controls";
import { readPuzzleLimits } from "@/features/chaal/puzzles/limits";
import { readDefaults } from "@/features/chaal/settings/preferences";
import { readWatchLimits } from "@/features/chaal/watch/limits";
import { staleError } from "@/lib/concurrency";
import type { Localized } from "@/lib/i18n/localized";
import { changes } from "@/server/audit/record";
import { notFound, withAudit } from "@/server/db/crud";
import { chSettings } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { DEFAULT_CHAAL_SETTINGS } from "../controls";
import type { ChaalAdminServices } from "./context";

/**
 * /admin/chaal/settings (PLAN Task 79, decision 0268): the one `ch_settings` row. The form
 * saves the switches, connecting, online play, puzzles (Task 80), watch (Task 82), community (Task 83), the defaults, the engine's
 * limits, the banner and the maintenance message from the version it opened at; maintenance itself and the
 * purge are their own writes, so they never make an open form stale. Every write is audited
 * and clears the controls' cache.
 */

const WHAT = "Chaal settings";
const ID = 1;
const TARGET = { type: "chaal-settings" as const, id: "settings" };

type Row = typeof chSettings.$inferSelect;

const EMPTY: Localized = { en: "", ne: "" };

const toAdmin = (row: Row, connectConfigured: boolean): ChaalAdminSettings => ({
	features: Object.fromEntries(CHAAL_FEATURES.map((feature) => [feature, featureOn(row.features, feature)])) as Record<
		ChaalFeature,
		boolean
	>,
	guestsMayConnect: row.guestsMayConnect,
	extraScopes: row.extraScopes.filter(isLichessScope),
	play: readPlayLimits(row.play),
	puzzles: readPuzzleLimits(row.puzzles),
	watch: readWatchLimits(row.watch),
	community: readCommunityLimits(row.community),
	defaults: readDefaults(row.defaults),
	engine: readEngineLimits(row.engine),
	banner: row.banner ?? EMPTY,
	maintenance: row.maintenance,
	maintenanceMessage: row.maintenanceMessage ?? EMPTY,
	cacheEpoch: row.cacheEpoch,
	connectConfigured,
	updatedAt: String(row.version),
});

/** The row, made with its defaults when there's none yet (a missing row means the defaults). */
async function settingsRow(db: Db | Tx): Promise<Row> {
	const [row] = await db.select().from(chSettings).where(eq(chSettings.id, ID));
	if (row) return row;
	const [made] = await db.insert(chSettings).values({ id: ID }).onConflictDoNothing().returning();
	if (made) return made;
	const [again] = await db.select().from(chSettings).where(eq(chSettings.id, ID));
	if (!again) throw notFound(WHAT);
	return again;
}

export const getSettings = async ({
	db,
	connectConfigured,
}: Pick<ChaalAdminServices, "db" | "connectConfigured">): Promise<ChaalAdminSettings> =>
	toAdmin(await settingsRow(db), connectConfigured);

/** Text with nothing in it is no text: the page hides it (or says the default). */
const textOrNull = (value: Localized): Localized | null => (value.en.trim() || value.ne.trim() ? value : null);

/** What the audit log shows of a row: flat values. */
function summary(row: Row) {
	const play = readPlayLimits(row.play);
	const engine = readEngineLimits(row.engine);
	const puzzles = readPuzzleLimits(row.puzzles);
	const watch = readWatchLimits(row.watch);
	const community = readCommunityLimits(row.community);
	const defaults = readDefaults(row.defaults);
	return {
		featuresOff: CHAAL_FEATURES.filter((feature) => !featureOn(row.features, feature)),
		guestsMayConnect: row.guestsMayConnect,
		extraScopes: [...row.extraScopes],
		aiMaxLevel: play.aiMaxLevel,
		rated: play.rated,
		quickPair: play.quickPair,
		puzzlesAhead: puzzles.ahead,
		puzzleStreak: puzzles.streak,
		tvChannels: watch.channels.join(", "),
		streamers: watch.streamers,
		joinTournaments: community.joinTournaments,
		joinTeams: community.joinTeams,
		saveToStudy: community.saveToStudy,
		studiesBy: community.studiesBy,
		defaults: `${defaults.board}, ${defaults.pieces}, ${defaults.sounds ? "sound" : "silent"}`,
		engine: `depth ${engine.maxDepth}, ${engine.multiPv} lines, ${engine.hashMb} MB`,
		banner: row.banner?.en ?? "",
		bannerNe: row.banner?.ne ?? "",
		maintenanceMessage: row.maintenanceMessage?.en ?? "",
		maintenanceMessageNe: row.maintenanceMessage?.ne ?? "",
	};
}
const SUMMARY_KEYS = Object.keys(summary(DEFAULT_CHAAL_SETTINGS)) as Array<keyof ReturnType<typeof summary>>;

export async function updateSettings(
	{ db, actor, controls, connectConfigured }: ChaalAdminServices,
	{ updatedAt, ...input }: ChaalSettingsInput,
): Promise<ChaalAdminSettings> {
	const saved = await withAudit(db, actor, async (tx, audit) => {
		const before = await settingsRow(tx);
		const [row] = await tx
			.update(chSettings)
			.set({
				// Only the switches that are off: a feature added later starts on (decision 0254).
				features: Object.fromEntries(
					CHAAL_FEATURES.filter((feature) => !input.features[feature]).map((feature) => [feature, false]),
				),
				guestsMayConnect: input.guestsMayConnect,
				extraScopes: input.extraScopes,
				play: input.play,
				puzzles: input.puzzles,
				watch: readWatchLimits(input.watch),
				community: readCommunityLimits(input.community),
				defaults: input.defaults,
				engine: input.engine,
				banner: textOrNull(input.banner),
				maintenanceMessage: textOrNull(input.maintenanceMessage),
				version: sql`${chSettings.version} + 1`,
			})
			.where(and(eq(chSettings.id, ID), eq(chSettings.version, Number(updatedAt))))
			.returning();
		// The row exists (settingsRow made it): no row back means someone saved since.
		if (!row) throw staleError(WHAT);
		const changed = changes(summary(before), summary(row), SUMMARY_KEYS);
		if (changed) audit({ action: "chaal.settings.update", target: TARGET, ...changed });
		return row;
	});
	controls.invalidate();
	return toAdmin(saved, connectConfigured);
}

/** Maintenance on or off: within 5 s nothing uses a player's token anywhere (this server at once). */
export async function setMaintenance(
	{ db, actor, controls, connectConfigured }: ChaalAdminServices,
	{ on }: { on: boolean },
): Promise<ChaalAdminSettings> {
	const saved = await withAudit(db, actor, async (tx, audit) => {
		const before = await settingsRow(tx);
		if (before.maintenance === on) return before;
		const [row] = await tx.update(chSettings).set({ maintenance: on }).where(eq(chSettings.id, ID)).returning();
		if (!row) throw notFound(WHAT);
		audit({
			action: "chaal.maintenance",
			target: TARGET,
			before: { maintenance: before.maintenance },
			after: { maintenance: on },
		});
		return row;
	});
	controls.invalidate();
	return toAdmin(saved, connectConfigured);
}

/** Purges Chaal's Lichess cache everywhere: every cache key carries the epoch, so bumping it misses them all. */
export async function purgeCache({
	db,
	actor,
	controls,
	connectConfigured,
}: ChaalAdminServices): Promise<ChaalAdminSettings> {
	const saved = await withAudit(db, actor, async (tx, audit) => {
		await settingsRow(tx);
		const [row] = await tx
			.update(chSettings)
			.set({ cacheEpoch: sql`${chSettings.cacheEpoch} + 1` })
			.where(eq(chSettings.id, ID))
			.returning();
		if (!row) throw notFound(WHAT);
		audit({ action: "chaal.cache.purge", target: TARGET, after: { cacheEpoch: row.cacheEpoch } });
		return row;
	});
	controls.invalidate();
	return toAdmin(saved, connectConfigured);
}
