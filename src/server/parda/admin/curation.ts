import "@tanstack/react-start/server-only";
import { and, asc, eq, inArray, max, ne, or } from "drizzle-orm";
import {
	type AdminBillboard,
	type AdminCollection,
	type AdminLayout,
	type BillboardInput,
	type CollectionInput,
	type LayoutInput,
	parseTitleRef,
	type TitleOption,
} from "@/features/parda/admin/schema";
import type { PardaPage } from "@/features/parda/search";
import { AppError, isAppError } from "@/lib/errors";
import type { Localized } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { notFound, withAudit } from "@/server/db/crud";
import { type PardaMedia, pdBillboard, pdCollection, pdCollectionItem, pdRail, pdTitle } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { searchCatalog, titleDetails, usCertificate } from "../catalog/service";
import { collectionRailKey, loadCuration, mergedRails, slotState } from "../curation";
import { rememberTitle } from "../library/saved-repository";
import { type PardaCurator, saveVersioned } from "./context";
import { titleNames } from "./takedowns";

/**
 * /admin/parda/billboard, /collections and /layout (PLAN Task 69, decision 0242). Read
 * with `parda:read`, changed with `parda:curate`, every write audited and clearing the
 * controls' cache. A chosen title is read through the catalogue once, so a blocked or
 * unknown one is refused, and its snapshot kept in `pd_title` names it in these lists.
 */

const BILLBOARD = "Parda billboard slot";
const COLLECTION = "Parda collection";

/** How many titles the picker offers. */
const PICKER_SIZE = 10;

// ---------------------------------------------------------------------------
// The picker
// ---------------------------------------------------------------------------

/** Titles for the picker, from TMDB through the catalogue (takedowns are gone). Empty without a catalogue. */
export async function searchTitles({ catalog }: PardaCurator, q: string): Promise<TitleOption[]> {
	if (!catalog || !q) return [];
	const { region } = await catalog.controls.settings();
	const { hits } = await searchCatalog(catalog, { locale: "en", region, cap: null }, "multi", q, 1);
	return hits
		.flatMap((hit) =>
			hit.media === "person"
				? []
				: [{ ref: `${hit.media}:${hit.id}`, media: hit.media, id: hit.id, title: hit.title, year: hit.year }],
		)
		.slice(0, PICKER_SIZE);
}

/** Keeps a snapshot of each title `pd_title` doesn't have; one that can't be read is an error on `field`. */
async function rememberTitles(
	{ db, catalog }: PardaCurator,
	refs: ReadonlyArray<{ media: PardaMedia; id: number }>,
	field: string,
) {
	if (refs.length === 0) return;
	const known = await db
		.select({ media: pdTitle.media, id: pdTitle.tmdbId })
		.from(pdTitle)
		.where(or(...refs.map((ref) => and(eq(pdTitle.media, ref.media), eq(pdTitle.tmdbId, ref.id)))));
	const missing = refs.filter((ref) => !known.some((row) => row.media === ref.media && row.id === ref.id));
	if (missing.length === 0) return;
	const refuse = () =>
		new AppError("BAD_REQUEST", "Parda: a chosen title can't be read", {
			fieldErrors: { [field]: [m.pd_admin_title_unavailable()] },
		});
	if (!catalog) throw refuse();
	const { region } = await catalog.controls.settings();
	await Promise.all(
		missing.map(async (ref) => {
			const read = (locale: "en" | "ne") =>
				titleDetails(catalog, { locale, region, cap: null }, ref.media, ref.id).catch((error: unknown) => {
					if (isAppError(error) && error.code === "NOT_FOUND") throw refuse();
					throw error;
				});
			const [english, nepali] = await Promise.all([read("en"), read("ne")]);
			await rememberTitle(db, {
				media: ref.media,
				tmdbId: ref.id,
				title: { en: english.title, ne: nepali.title || english.title },
				poster: english.poster,
				backdrop: english.backdrop,
				year: english.year,
				genres: english.genres,
				runtime: english.runtime,
				certification: usCertificate(english),
				certificationCheckedAt: new Date(),
			});
		}),
	);
}

const emptyToNull = (text: string) => (text === "" ? null : text);
const taglineOf = (tagline: Localized) => (tagline.en.trim() ? tagline : null);

// ---------------------------------------------------------------------------
// Billboard slots
// ---------------------------------------------------------------------------

type BillboardRow = typeof pdBillboard.$inferSelect;

const toBillboard = (row: BillboardRow, title: Localized | null | undefined): AdminBillboard => ({
	id: row.id,
	page: row.page,
	media: row.media,
	tmdbId: row.tmdbId,
	title: title ?? null,
	tagline: row.tagline ?? { en: "", ne: "" },
	startsOn: row.startsOn ?? "",
	endsOn: row.endsOn ?? "",
	state: slotState(row),
	updatedAt: String(row.version),
});

const billboardTarget = (row: BillboardRow, title?: Localized | null) => ({
	type: "parda-billboard" as const,
	id: row.id,
	label: title?.en || `${row.media}/${row.tmdbId}`,
});

const billboardSummary = (row: BillboardRow) => ({
	page: row.page,
	media: row.media,
	tmdbId: row.tmdbId,
	tagline: row.tagline?.en ?? null,
	startsOn: row.startsOn,
	endsOn: row.endsOn,
});

/** Every slot, each page's in its order. */
export async function listBillboards({ db }: { db: Db }): Promise<AdminBillboard[]> {
	const rows = await db
		.select()
		.from(pdBillboard)
		.orderBy(asc(pdBillboard.page), asc(pdBillboard.position), asc(pdBillboard.createdAt));
	const names = await titleNames(db, rows);
	return rows.map((row) => toBillboard(row, names.get(`${row.media}:${row.tmdbId}`)));
}

export async function getBillboard({ db }: { db: Db }, id: string): Promise<AdminBillboard> {
	const [row] = await db.select().from(pdBillboard).where(eq(pdBillboard.id, id));
	if (!row) throw notFound(BILLBOARD);
	const names = await titleNames(db, [row]);
	return toBillboard(row, names.get(`${row.media}:${row.tmdbId}`));
}

const billboardFields = (input: BillboardInput) => {
	const { media, id } = parseTitleRef(input.title);
	return {
		page: input.page,
		media,
		tmdbId: id,
		tagline: taglineOf(input.tagline),
		startsOn: emptyToNull(input.startsOn),
		endsOn: emptyToNull(input.endsOn),
	};
};

/** A new slot goes last on its page. */
export async function createBillboard(ctx: PardaCurator, input: BillboardInput): Promise<AdminBillboard> {
	const fields = billboardFields(input);
	await rememberTitles(ctx, [{ media: fields.media, id: fields.tmdbId }], "title");
	const created = await withAudit(ctx.db, ctx.actor, async (tx, audit) => {
		const [last] = await tx
			.select({ position: max(pdBillboard.position) })
			.from(pdBillboard)
			.where(eq(pdBillboard.page, fields.page));
		const [row] = await tx
			.insert(pdBillboard)
			.values({ ...fields, position: (last?.position ?? -1) + 1 })
			.returning();
		if (!row) throw notFound(BILLBOARD);
		const names = await titleNames(tx, [row]);
		const title = names.get(`${row.media}:${row.tmdbId}`);
		audit({ action: "parda.billboard.create", target: billboardTarget(row, title), after: billboardSummary(row) });
		return toBillboard(row, title);
	});
	ctx.controls.invalidate();
	return created;
}

export async function updateBillboard(
	ctx: PardaCurator,
	{ id, updatedAt, ...input }: BillboardInput & { id: string; updatedAt: string },
): Promise<AdminBillboard> {
	const fields = billboardFields(input);
	await rememberTitles(ctx, [{ media: fields.media, id: fields.tmdbId }], "title");
	const saved = await withAudit(ctx.db, ctx.actor, async (tx, audit) => {
		const [before] = await tx.select().from(pdBillboard).where(eq(pdBillboard.id, id));
		if (!before) throw notFound(BILLBOARD);
		const row = await saveVersioned(tx, pdBillboard, {
			id,
			version: Number(updatedAt),
			// Moved to another page, it goes last there.
			set: before.page === fields.page ? fields : { ...fields, position: await nextPosition(tx, fields.page) },
			what: BILLBOARD,
		});
		const names = await titleNames(tx, [row]);
		const title = names.get(`${row.media}:${row.tmdbId}`);
		audit({
			action: "parda.billboard.update",
			target: billboardTarget(row, title),
			before: billboardSummary(before),
			after: billboardSummary(row),
		});
		return toBillboard(row, title);
	});
	ctx.controls.invalidate();
	return saved;
}

const nextPosition = async (tx: Tx, page: PardaPage) => {
	const [last] = await tx
		.select({ position: max(pdBillboard.position) })
		.from(pdBillboard)
		.where(eq(pdBillboard.page, page));
	return (last?.position ?? -1) + 1;
};

/** A page's whole order at once: every slot on it, each once, or nothing changes. */
export async function reorderBillboards(
	{ db, actor, controls }: PardaCurator,
	{ page, ids }: { page: PardaPage; ids: ReadonlyArray<string> },
): Promise<{ moved: number }> {
	const moved = await withAudit(db, actor, async (tx, audit) => {
		const rows = await tx
			.select({ id: pdBillboard.id, position: pdBillboard.position })
			.from(pdBillboard)
			.where(eq(pdBillboard.page, page))
			.for("update");
		const known = new Set(rows.map((row) => row.id));
		if (new Set(ids).size !== ids.length || ids.length !== known.size || ids.some((id) => !known.has(id))) {
			throw new AppError("BAD_REQUEST", `${BILLBOARD}: the order must list every slot on the page once`);
		}
		const current = new Map(rows.map((row) => [row.id, row.position]));
		let count = 0;
		for (const [position, id] of ids.entries()) {
			if (current.get(id) === position) continue;
			await tx.update(pdBillboard).set({ position }).where(eq(pdBillboard.id, id));
			count += 1;
		}
		if (count > 0) {
			audit({
				action: "parda.billboard.reorder",
				target: { type: "parda-billboard", id: page },
				after: { page, order: [...ids] },
			});
		}
		return count;
	});
	controls.invalidate();
	return { moved };
}

export async function deleteBillboards(
	{ db, actor, controls }: PardaCurator,
	ids: ReadonlyArray<string>,
): Promise<{ deleted: number }> {
	const deleted = await withAudit(db, actor, async (tx, audit) => {
		const rows = await tx
			.delete(pdBillboard)
			.where(inArray(pdBillboard.id, [...ids]))
			.returning();
		audit(
			...rows.map((row) => ({
				action: "parda.billboard.delete" as const,
				target: billboardTarget(row),
				before: billboardSummary(row),
			})),
		);
		return rows.length;
	});
	controls.invalidate();
	return { deleted };
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

type CollectionRow = typeof pdCollection.$inferSelect;
type ItemRow = typeof pdCollectionItem.$inferSelect;

const slugTaken = () =>
	new AppError("CONFLICT", `${COLLECTION}: slug taken`, { fieldErrors: { slug: [m.slug_field_taken()] } });

async function toCollections(
	db: Db,
	rows: ReadonlyArray<CollectionRow>,
	items: ReadonlyArray<ItemRow>,
): Promise<AdminCollection[]> {
	const names = await titleNames(db, items);
	return rows.map((row) => {
		const own = items.filter((item) => item.collectionId === row.id);
		return {
			id: row.id,
			name: row.name,
			slug: row.slug,
			description: row.description ?? { en: "", ne: "" },
			published: row.published,
			count: own.length,
			items: own.map((item) => ({
				ref: `${item.media}:${item.tmdbId}`,
				media: item.media,
				tmdbId: item.tmdbId,
				title: names.get(`${item.media}:${item.tmdbId}`) ?? null,
			})),
			updatedAt: String(row.version),
			modifiedAt: row.updatedAt.toISOString(),
		};
	});
}

const itemsOf = (db: Db, ids: ReadonlyArray<string>) =>
	ids.length === 0
		? Promise.resolve([])
		: db
				.select()
				.from(pdCollectionItem)
				.where(inArray(pdCollectionItem.collectionId, [...ids]))
				.orderBy(asc(pdCollectionItem.position));

export async function listCollections({ db }: { db: Db }): Promise<AdminCollection[]> {
	const rows = await db.select().from(pdCollection).orderBy(asc(pdCollection.createdAt));
	return toCollections(
		db,
		rows,
		await itemsOf(
			db,
			rows.map((row) => row.id),
		),
	);
}

export async function getCollection({ db }: { db: Db }, id: string): Promise<AdminCollection> {
	const [row] = await db.select().from(pdCollection).where(eq(pdCollection.id, id));
	if (!row) throw notFound(COLLECTION);
	const [collection] = await toCollections(db, [row], await itemsOf(db, [id]));
	return collection as AdminCollection;
}

const collectionFields = (input: CollectionInput) => ({
	slug: input.slug,
	name: input.name,
	description: input.description.en.trim() ? input.description : null,
	published: input.published,
});

const collectionTarget = (row: CollectionRow) => ({
	type: "parda-collection" as const,
	id: row.id,
	label: row.name.en,
});

const collectionSummary = (row: CollectionRow, items: ReadonlyArray<string>) => ({
	slug: row.slug,
	name: row.name.en,
	published: row.published,
	items: [...items],
});

const uniqueRefs = (refs: ReadonlyArray<string>) => [...new Set(refs)];

async function replaceItems(tx: Tx, collectionId: string, refs: ReadonlyArray<string>) {
	await tx.delete(pdCollectionItem).where(eq(pdCollectionItem.collectionId, collectionId));
	if (refs.length === 0) return;
	await tx.insert(pdCollectionItem).values(
		refs.map((ref, position) => {
			const { media, id } = parseTitleRef(ref);
			return { collectionId, media, tmdbId: id, position };
		}),
	);
}

export async function createCollection(ctx: PardaCurator, input: CollectionInput): Promise<AdminCollection> {
	const refs = uniqueRefs(input.items);
	await rememberTitles(ctx, refs.map(parseTitleRef), "items");
	const created = await withAudit(ctx.db, ctx.actor, async (tx, audit) => {
		// On conflict, nothing: a taken slug is a field error without a failed statement (decision 0237).
		const [row] = await tx
			.insert(pdCollection)
			.values(collectionFields(input))
			.onConflictDoNothing({ target: pdCollection.slug })
			.returning();
		if (!row) throw slugTaken();
		await replaceItems(tx, row.id, refs);
		audit({ action: "parda.collection.create", target: collectionTarget(row), after: collectionSummary(row, refs) });
		return row;
	});
	ctx.controls.invalidate();
	return getCollection(ctx, created.id);
}

export async function updateCollection(
	ctx: PardaCurator,
	{ id, updatedAt, ...input }: CollectionInput & { id: string; updatedAt: string },
): Promise<AdminCollection> {
	const refs = uniqueRefs(input.items);
	await rememberTitles(ctx, refs.map(parseTitleRef), "items");
	await withAudit(ctx.db, ctx.actor, async (tx, audit) => {
		const [before] = await tx.select().from(pdCollection).where(eq(pdCollection.id, id));
		if (!before) throw notFound(COLLECTION);
		const [taken] = await tx
			.select({ id: pdCollection.id })
			.from(pdCollection)
			.where(and(eq(pdCollection.slug, input.slug), ne(pdCollection.id, id)));
		if (taken) throw slugTaken();
		const beforeItems = await tx
			.select()
			.from(pdCollectionItem)
			.where(eq(pdCollectionItem.collectionId, id))
			.orderBy(asc(pdCollectionItem.position));
		const row = await saveVersioned(tx, pdCollection, {
			id,
			version: Number(updatedAt),
			set: collectionFields(input),
			what: COLLECTION,
		});
		await replaceItems(tx, id, refs);
		audit({
			action: "parda.collection.update",
			target: collectionTarget(row),
			before: collectionSummary(
				before,
				beforeItems.map((item) => `${item.media}:${item.tmdbId}`),
			),
			after: collectionSummary(row, refs),
		});
	});
	ctx.controls.invalidate();
	return getCollection(ctx, id);
}

/** Its items and its place in every layout go with it. */
export async function deleteCollections(
	{ db, actor, controls }: PardaCurator,
	ids: ReadonlyArray<string>,
): Promise<{ deleted: number }> {
	const deleted = await withAudit(db, actor, async (tx, audit) => {
		const rows = await tx
			.delete(pdCollection)
			.where(inArray(pdCollection.id, [...ids]))
			.returning();
		audit(
			...rows.map((row) => ({
				action: "parda.collection.delete" as const,
				target: collectionTarget(row),
				before: { slug: row.slug, name: row.name.en, published: row.published },
			})),
		);
		return rows.length;
	});
	controls.invalidate();
	return { deleted };
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

export async function getLayout({ db }: { db: Db }, page: PardaPage): Promise<AdminLayout> {
	const curation = await loadCuration(db);
	return {
		page,
		saved: curation.rails.some((row) => row.page === page),
		rails: mergedRails(page, curation).map((rail) =>
			rail.collection
				? {
						key: rail.key,
						visible: rail.visible,
						label: { text: rail.collection.name.en },
						collection: { name: rail.collection.name, published: rail.collection.published },
					}
				: { key: rail.key, visible: rail.visible, label: rail.spec.label, collection: null },
		),
	};
}

/** A rail in the audit log: its key, and whether it is hidden. */
const railAudit = (rail: { key: string; visible: boolean }) => (rail.visible ? rail.key : `${rail.key} (hidden)`);

/** A page's whole layout at once: every rail it has, each once, or nothing changes. */
export async function saveLayout(
	{ db, actor, controls }: PardaCurator,
	{ page, rails }: LayoutInput,
): Promise<AdminLayout> {
	const saved = await withAudit(db, actor, async (tx, audit) => {
		const curation = await loadCuration(tx);
		const known = mergedRails(page, curation);
		const keys = new Set(known.map((rail) => rail.key));
		if (
			new Set(rails.map((rail) => rail.key)).size !== rails.length ||
			rails.length !== keys.size ||
			rails.some((rail) => !keys.has(rail.key))
		) {
			throw new AppError("BAD_REQUEST", "Parda layout: it must list every rail on the page once");
		}
		const collectionIds = new Map(curation.collections.map((each) => [collectionRailKey(each.id), each.id]));
		await tx.delete(pdRail).where(eq(pdRail.page, page));
		await tx.insert(pdRail).values(
			rails.map((rail, position) => ({
				page,
				key: rail.key,
				collectionId: collectionIds.get(rail.key) ?? null,
				position,
				visible: rail.visible,
			})),
		);
		audit({
			action: "parda.layout.update",
			target: { type: "parda-layout", id: page, label: page },
			before: { rails: known.map(railAudit) },
			after: { rails: rails.map(railAudit) },
		});
		return getLayout({ db: tx }, page);
	});
	controls.invalidate();
	return saved;
}
