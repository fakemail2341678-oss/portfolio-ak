import "@tanstack/react-start/server-only";
import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import type { ChaalAdminCuration, ChaalAdminFeatured, ChaalFeaturedInput } from "@/features/chaal/admin/schema";
import {
	type ChaalFeaturedKind,
	type ChaalFeaturedSection,
	type ChaalHomeSectionKey,
	featuredState,
	mergedSections,
	parseFeaturedRef,
	SECTION_KINDS,
	sectionOf,
} from "@/features/chaal/home/curation";
import { staleError } from "@/lib/concurrency";
import { AppError } from "@/lib/errors";
import type { Localized } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { isUniqueViolation, notFound, withAudit } from "@/server/db/crud";
import { chFeatured, chHomeSection, chSettings } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { chaalToday } from "../home";
import type { ChaalAdminServices } from "./context";
import { settingsRow } from "./settings";

/**
 * /admin/chaal/curation (PLAN Task 84, decision 0274): featured broadcasts, tournaments,
 * studies and puzzle themes; the home's section order; the announcement. Read with
 * `chaal:read`, changed with `chaal:curate`, every write audited and clearing the controls'
 * cache, so the home shows it at once on this server and within 5 s on the others.
 */

const FEATURED = "Chaal featured item";
const EMPTY: Localized = { en: "", ne: "" };

type Row = typeof chFeatured.$inferSelect;

const toAdmin = (row: Row, today: string): ChaalAdminFeatured => ({
	id: row.id,
	kind: row.kind,
	ref: row.ref,
	title: row.title,
	startsOn: row.startsOn ?? "",
	endsOn: row.endsOn ?? "",
	state: featuredState(row, today),
	updatedAt: String(row.version),
});

const target = (row: Row) => ({ type: "chaal-featured" as const, id: row.id, label: row.title.en || row.ref });
const summary = (row: Row) => ({
	kind: row.kind,
	ref: row.ref,
	title: row.title.en,
	startsOn: row.startsOn,
	endsOn: row.endsOn,
});

/** The whole page: every featured item (each section's in order), the sections, the announcement. */
export async function getCuration({ db }: { db: Db }, now: Date = new Date()): Promise<ChaalAdminCuration> {
	const today = chaalToday(now);
	const [rows, sections, settings] = await Promise.all([
		db.select().from(chFeatured).orderBy(asc(chFeatured.position), asc(chFeatured.createdAt)),
		db.select().from(chHomeSection),
		settingsRow(db),
	]);
	return {
		featured: rows.map((row) => toAdmin(row, today)),
		sections: mergedSections(sections),
		announcement: settings.announcement ?? EMPTY,
	};
}

/** The row's fields from the form's: the id read out of an address, empty dates as none, Nepali falling back. */
function fieldsOf(input: ChaalFeaturedInput) {
	const ref = parseFeaturedRef(input.kind, input.ref);
	if (ref === null) {
		throw new AppError("BAD_REQUEST", `${FEATURED}: the id doesn't read`, {
			fieldErrors: { ref: [m.ch_admin_featured_ref_invalid()] },
		});
	}
	return {
		kind: input.kind,
		ref,
		title: input.title,
		startsOn: input.startsOn || null,
		endsOn: input.endsOn || null,
	};
}

const duplicate = (error: unknown) =>
	isUniqueViolation(error, "ch_featured_ref_unique")
		? new AppError("CONFLICT", `${FEATURED}: already featured`, {
				fieldErrors: { ref: [m.ch_admin_featured_duplicate()] },
			})
		: error;

/** After the last item of the kind's section. */
async function nextPosition(tx: Tx, kind: ChaalFeaturedKind) {
	const [last] = await tx
		.select({ position: max(chFeatured.position) })
		.from(chFeatured)
		.where(inArray(chFeatured.kind, [...SECTION_KINDS[sectionOf(kind)]]));
	return (last?.position ?? -1) + 1;
}

export async function createFeatured(
	{ db, actor, controls }: ChaalAdminServices,
	input: ChaalFeaturedInput,
	now: Date = new Date(),
): Promise<ChaalAdminFeatured> {
	const fields = fieldsOf(input);
	const created = await withAudit(db, actor, async (tx, audit) => {
		const [row] = await tx
			.insert(chFeatured)
			.values({ ...fields, position: await nextPosition(tx, fields.kind) })
			.returning();
		if (!row) throw notFound(FEATURED);
		audit({ action: "chaal.featured.create", target: target(row), after: summary(row) });
		return row;
	}).catch((error: unknown) => {
		throw duplicate(error);
	});
	controls.invalidate();
	return toAdmin(created, chaalToday(now));
}

export async function updateFeatured(
	{ db, actor, controls }: ChaalAdminServices,
	{ id, updatedAt, ...input }: ChaalFeaturedInput & { id: string; updatedAt: string },
	now: Date = new Date(),
): Promise<ChaalAdminFeatured> {
	const fields = fieldsOf(input);
	const saved = await withAudit(db, actor, async (tx, audit) => {
		const [before] = await tx.select().from(chFeatured).where(eq(chFeatured.id, id));
		if (!before) throw notFound(FEATURED);
		// Moved to another section (an arena made a study), it goes last there.
		const moved = sectionOf(before.kind) !== sectionOf(fields.kind);
		const [row] = await tx
			.update(chFeatured)
			.set({
				...fields,
				...(moved ? { position: await nextPosition(tx, fields.kind) } : {}),
				version: sql`${chFeatured.version} + 1`,
			})
			.where(and(eq(chFeatured.id, id), eq(chFeatured.version, Number(updatedAt))))
			.returning();
		if (!row) throw staleError(FEATURED);
		audit({ action: "chaal.featured.update", target: target(row), before: summary(before), after: summary(row) });
		return row;
	}).catch((error: unknown) => {
		throw duplicate(error);
	});
	controls.invalidate();
	return toAdmin(saved, chaalToday(now));
}

/** A section's whole order at once: every item in it, each once, or nothing changes. */
export async function reorderFeatured(
	{ db, actor, controls }: ChaalAdminServices,
	{ section, ids }: { section: ChaalFeaturedSection; ids: ReadonlyArray<string> },
): Promise<{ moved: number }> {
	const moved = await withAudit(db, actor, async (tx, audit) => {
		const rows = await tx
			.select({ id: chFeatured.id, position: chFeatured.position })
			.from(chFeatured)
			.where(inArray(chFeatured.kind, [...SECTION_KINDS[section]]))
			.for("update");
		const known = new Set(rows.map((row) => row.id));
		if (new Set(ids).size !== ids.length || ids.length !== known.size || ids.some((id) => !known.has(id))) {
			throw new AppError("BAD_REQUEST", `${FEATURED}: the order must list every item in the section once`);
		}
		const current = new Map(rows.map((row) => [row.id, row.position]));
		let count = 0;
		for (const [position, id] of ids.entries()) {
			if (current.get(id) === position) continue;
			await tx.update(chFeatured).set({ position }).where(eq(chFeatured.id, id));
			count += 1;
		}
		if (count > 0) {
			audit({
				action: "chaal.featured.reorder",
				target: { type: "chaal-featured", id: section },
				after: { section, order: [...ids] },
			});
		}
		return count;
	});
	controls.invalidate();
	return { moved };
}

export async function deleteFeatured(
	{ db, actor, controls }: ChaalAdminServices,
	ids: ReadonlyArray<string>,
): Promise<{ deleted: number }> {
	const deleted = await withAudit(db, actor, async (tx, audit) => {
		const rows = await tx
			.delete(chFeatured)
			.where(inArray(chFeatured.id, [...ids]))
			.returning();
		audit(
			...rows.map((row) => ({ action: "chaal.featured.delete" as const, target: target(row), before: summary(row) })),
		);
		return rows.length;
	});
	controls.invalidate();
	return { deleted };
}

/** The home's sections, all of them in their new order, each shown or hidden. */
export async function saveHomeSections(
	{ db, actor, controls }: ChaalAdminServices,
	{ sections }: { sections: ReadonlyArray<{ key: ChaalHomeSectionKey; visible: boolean }> },
): Promise<ChaalAdminCuration["sections"]> {
	await withAudit(db, actor, async (tx, audit) => {
		const before = mergedSections(await tx.select().from(chHomeSection));
		await tx.delete(chHomeSection);
		await tx
			.insert(chHomeSection)
			.values(sections.map((section, position) => ({ key: section.key, visible: section.visible, position })));
		const label = (list: ReadonlyArray<{ key: string; visible: boolean }>) =>
			list.map((section) => (section.visible ? section.key : `${section.key} (hidden)`));
		audit({
			action: "chaal.home.update",
			target: { type: "chaal-home", id: "home" },
			before: { sections: label(before) },
			after: { sections: label(sections) },
		});
	});
	controls.invalidate();
	return [...sections];
}

/** The home's announcement: its own write, so it never makes the settings form stale. */
export async function saveAnnouncement(
	{ db, actor, controls }: ChaalAdminServices,
	{ announcement }: { announcement: Localized },
): Promise<Localized> {
	const value = announcement.en ? announcement : null;
	await withAudit(db, actor, async (tx, audit) => {
		const before = await settingsRow(tx);
		await tx.update(chSettings).set({ announcement: value }).where(eq(chSettings.id, before.id));
		audit({
			action: "chaal.announcement",
			target: { type: "chaal-home", id: "home" },
			before: { announcement: before.announcement?.en ?? null },
			after: { announcement: value?.en ?? null },
		});
	});
	controls.invalidate();
	return value ?? EMPTY;
}
