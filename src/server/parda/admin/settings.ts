import "@tanstack/react-start/server-only";
import { eq, sql } from "drizzle-orm";
import type { AdminSettings, SettingsInput } from "@/features/parda/admin/schema";
import { locales } from "@/paraglide/runtime";
import { changes } from "@/server/audit/record";
import { notFound, withAudit } from "@/server/db/crud";
import { pdSettings } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { type PardaAdminServices, saveVersioned } from "./context";

/**
 * /admin/parda/settings (PLAN Task 65, decision 0237): the one `pd_settings` row. The form
 * saves region, languages, the kids' cap and the banner from the version it opened at; the
 * kill switch and the purge are their own writes, so they never make an open form stale.
 */

const WHAT = "Parda settings";
const ID = 1;

type Row = typeof pdSettings.$inferSelect;

const isLocale = (value: string): value is (typeof locales)[number] =>
	(locales as ReadonlyArray<string>).includes(value);

const toAdmin = (row: Row): AdminSettings => ({
	region: row.region,
	languages: row.languages.filter(isLocale),
	kidsCap: row.kidsCap,
	banner: row.banner ?? { en: "", ne: "" },
	playbackEnabled: row.playbackEnabled,
	cacheEpoch: row.cacheEpoch,
	sourceOrder: row.sourceOrder,
	updatedAt: String(row.version),
});

/** The row, made with its defaults if a database lost it (the migration inserts it). */
async function settingsRow(db: Db | Tx): Promise<Row> {
	const [row] = await db.select().from(pdSettings).where(eq(pdSettings.id, ID));
	if (row) return row;
	const [made] = await db.insert(pdSettings).values({ id: ID }).onConflictDoNothing().returning();
	if (made) return made;
	const [again] = await db.select().from(pdSettings).where(eq(pdSettings.id, ID));
	if (!again) throw notFound(WHAT);
	return again;
}

export const getSettings = async ({ db }: { db: Db }): Promise<AdminSettings> => toAdmin(await settingsRow(db));

const summary = (row: Row) => ({
	region: row.region,
	languages: row.languages,
	kidsCap: row.kidsCap,
	banner: row.banner?.en ?? "",
	bannerNe: row.banner?.ne ?? "",
});
const TARGET = { type: "parda-settings" as const, id: "settings" };

export async function updateSettings(
	{ db, actor, controls }: PardaAdminServices,
	{ updatedAt, ...input }: SettingsInput,
): Promise<AdminSettings> {
	const saved = await withAudit(db, actor, async (tx, audit) => {
		const before = await settingsRow(tx);
		const banner = input.banner.en || input.banner.ne ? input.banner : null;
		const row = await saveVersioned(tx, pdSettings, {
			id: ID,
			version: Number(updatedAt),
			set: {
				region: input.region,
				// Kept in the app's order, so the first is predictable.
				languages: locales.filter((locale) => input.languages.includes(locale)),
				kidsCap: input.kidsCap,
				banner,
			},
			what: WHAT,
		});
		const changed = changes(summary(before), summary(row), ["region", "languages", "kidsCap", "banner", "bannerNe"]);
		if (changed) audit({ action: "parda.settings.update", target: TARGET, ...changed });
		return row;
	});
	controls.invalidate();
	return toAdmin(saved);
}

/** The kill switch: off, no player loads anywhere within 30 s (this server at once). */
export async function setPlayback(
	{ db, actor, controls }: PardaAdminServices,
	{ enabled }: { enabled: boolean },
): Promise<AdminSettings> {
	const saved = await withAudit(db, actor, async (tx, audit) => {
		const before = await settingsRow(tx);
		if (before.playbackEnabled === enabled) return before;
		const [row] = await tx
			.update(pdSettings)
			.set({ playbackEnabled: enabled })
			.where(eq(pdSettings.id, ID))
			.returning();
		if (!row) throw notFound(WHAT);
		audit({
			action: "parda.playback",
			target: TARGET,
			before: { playbackEnabled: before.playbackEnabled },
			after: { playbackEnabled: enabled },
		});
		return row;
	});
	controls.invalidate();
	return toAdmin(saved);
}

/**
 * The sources' order (decision 0238): `auto` by the daily scores, `manual` the admin's.
 * Its own write, like the kill switch, so an open settings form stays current.
 */
export async function setSourceOrder(
	{ db, actor, controls }: PardaAdminServices,
	{ mode }: { mode: "auto" | "manual" },
): Promise<AdminSettings> {
	const saved = await withAudit(db, actor, async (tx, audit) => {
		const before = await settingsRow(tx);
		if (before.sourceOrder === mode) return before;
		const [row] = await tx.update(pdSettings).set({ sourceOrder: mode }).where(eq(pdSettings.id, ID)).returning();
		if (!row) throw notFound(WHAT);
		audit({
			action: "parda.source.order",
			target: TARGET,
			before: { sourceOrder: before.sourceOrder },
			after: { sourceOrder: mode },
		});
		return row;
	});
	controls.invalidate();
	return toAdmin(saved);
}

/** Purges the catalogue cache everywhere: every cache key carries the epoch, so bumping it misses them all. */
export async function purgeCache({ db, actor, controls }: PardaAdminServices): Promise<AdminSettings> {
	const saved = await withAudit(db, actor, async (tx, audit) => {
		await settingsRow(tx);
		const [row] = await tx
			.update(pdSettings)
			.set({ cacheEpoch: sql`${pdSettings.cacheEpoch} + 1` })
			.where(eq(pdSettings.id, ID))
			.returning();
		if (!row) throw notFound(WHAT);
		audit({ action: "parda.cache.purge", target: TARGET, after: { cacheEpoch: row.cacheEpoch } });
		return row;
	});
	controls.invalidate();
	return toAdmin(saved);
}
