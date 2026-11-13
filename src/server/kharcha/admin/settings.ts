import "@tanstack/react-start/server-only";
import { and, eq, sql } from "drizzle-orm";
import type { AuditValue } from "@/features/audit/schema";
import type { KharchaAdminSettings, UpdateKharchaSettingsInput } from "@/features/kharcha/admin/schema";
import { type KharchaSettings, kharchaSettings, QUOTA_DEFAULTS } from "@/features/kharcha/settings";
import { staleError } from "@/lib/concurrency";
import { changes } from "@/server/audit/record";
import { notFound, withAudit } from "@/server/db/crud";
import { khSettings } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import type { Services } from "@/server/services";

/**
 * /admin/kharcha/settings (PLAN Task 96, decision 0290): the one `kh_settings` row. The
 * form saves every setting from the version it opened at; a stale save is a CONFLICT the
 * form turns into "reload". Every save is audited, flat.
 */

const WHAT = "Kharcha settings";
const ID = 1;
const TARGET = { type: "kharcha-settings" as const, id: "settings" };

type Row = typeof khSettings.$inferSelect;

/** The row, made with its defaults when there's none yet (a missing row means the defaults). */
async function settingsRow(db: Db | Tx): Promise<Row> {
	const [row] = await db.select().from(khSettings).where(eq(khSettings.id, ID));
	if (row) return row;
	const [made] = await db.insert(khSettings).values({ id: ID }).onConflictDoNothing().returning();
	if (made) return made;
	const [again] = await db.select().from(khSettings).where(eq(khSettings.id, ID));
	if (!again) throw notFound(WHAT);
	return again;
}

const view = (row: Row): KharchaAdminSettings => ({
	settings: kharchaSettings.parse(row.settings),
	updatedAt: String(row.version),
});

export const getAdminSettings = async ({ db }: Pick<Services, "db">): Promise<KharchaAdminSettings> =>
	view(await settingsRow(db));

const QUOTA_KEYS = Object.keys(QUOTA_DEFAULTS) as Array<keyof typeof QUOTA_DEFAULTS>;

/** What the audit log shows of the settings: flat values, the categories by key. */
function summary(settings: KharchaSettings): Record<string, AuditValue> {
	return {
		...Object.fromEntries(QUOTA_KEYS.map((key) => [`quotas.${key}`, settings.quotas[key]])),
		...Object.fromEntries(QUOTA_KEYS.map((key) => [`guestQuotas.${key}`, settings.guestQuotas[key]])),
		currencies: settings.currencies,
		invites: settings.invites,
		reminders: settings.reminders,
		uploadsPerHour: settings.uploadsPerHour,
		digestHour: settings.digestHour,
		categories: settings.categories.map((category) => category.key),
		// Names, icons and colours change without the keys: the whole list, as one value.
		categoryDetails: JSON.stringify(settings.categories),
	};
}

export async function updateAdminSettings(
	{ db, actor }: Pick<Services, "db" | "actor">,
	{ updatedAt, settings }: UpdateKharchaSettingsInput,
): Promise<KharchaAdminSettings> {
	return withAudit(db, actor, async (tx, audit) => {
		const before = await settingsRow(tx);
		const [saved] = await tx
			.update(khSettings)
			.set({ settings, version: sql`${khSettings.version} + 1` })
			.where(and(eq(khSettings.id, ID), eq(khSettings.version, Number(updatedAt))))
			.returning();
		if (!saved) throw staleError(WHAT);
		const was = summary(kharchaSettings.parse(before.settings));
		const now = summary(kharchaSettings.parse(saved.settings));
		const keys = Object.keys(now);
		const changed = changes(
			was,
			now,
			keys,
			keys.filter((key) => key !== "categoryDetails"),
		);
		if (changed) audit({ action: "kharcha.settings.update", target: TARGET, ...changed });
		return view(saved);
	});
}
