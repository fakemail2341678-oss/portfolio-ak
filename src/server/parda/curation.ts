import "@tanstack/react-start/server-only";
import { asc } from "drizzle-orm";
import type { PardaPage } from "@/features/parda/search";
import { todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import type { Localized } from "@/lib/i18n/localized";
import { type PardaMedia, pdBillboard, pdCollection, pdCollectionItem, pdRail } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { PAGE_LAYOUTS, type RailSpec } from "./catalog/rails";

/**
 * What the admin curates (PLAN Task 69, decision 0242), as the controls hold it for 30 s:
 * billboard slots, collections and each page's saved rails, and the pure rules that turn
 * them into a page. It imports nothing from the catalogue, which reads it through the
 * controls.
 */

export type BillboardRow = typeof pdBillboard.$inferSelect;
export type RailRow = typeof pdRail.$inferSelect;

export type CuratedCollection = {
	id: string;
	slug: string;
	name: Localized;
	description: Localized | null;
	published: boolean;
	items: ReadonlyArray<{ media: PardaMedia; id: number }>;
	updatedAt: Date;
};

export type Curation = {
	billboards: ReadonlyArray<BillboardRow>;
	collections: ReadonlyArray<CuratedCollection>;
	rails: ReadonlyArray<RailRow>;
};

export async function loadCuration(db: Db): Promise<Curation> {
	const [billboards, collections, items, rails] = await Promise.all([
		db.select().from(pdBillboard).orderBy(asc(pdBillboard.position), asc(pdBillboard.createdAt)),
		db.select().from(pdCollection).orderBy(asc(pdCollection.createdAt)),
		db.select().from(pdCollectionItem).orderBy(asc(pdCollectionItem.position)),
		db.select().from(pdRail).orderBy(asc(pdRail.position)),
	]);
	return {
		billboards,
		rails,
		collections: collections.map((row) => ({
			id: row.id,
			slug: row.slug,
			name: row.name,
			description: row.description,
			published: row.published,
			updatedAt: row.updatedAt,
			items: items
				.filter((item) => item.collectionId === row.id)
				.map((item) => ({ media: item.media, id: item.tmdbId })),
		})),
	};
}

/** A collection's rail, by the id the client asks for it with. */
export const collectionRailKey = (collectionId: string) => `c-${collectionId}`;

export type PageRail =
	| { key: string; visible: boolean; spec: RailSpec; collection?: never }
	| { key: string; visible: boolean; collection: CuratedCollection; spec?: never };

/**
 * A page's rails as the layout page lists them: the saved rows in order, then rails in
 * code the rows don't name (on, last: so a page never saved is the config's order, and a
 * rail added later appears), then collections they don't name (off, until placed).
 */
export function mergedRails(page: PardaPage, curation: Curation): PageRail[] {
	const specs = new Map(PAGE_LAYOUTS[page].rails.map((spec) => [spec.id, spec]));
	const collections = new Map(curation.collections.map((each) => [collectionRailKey(each.id), each]));
	const merged: PageRail[] = [];
	for (const row of curation.rails) {
		if (row.page !== page) continue;
		const spec = specs.get(row.key);
		const collection = collections.get(row.key);
		if (spec) merged.push({ key: row.key, visible: row.visible, spec });
		else if (collection) merged.push({ key: row.key, visible: row.visible, collection });
		specs.delete(row.key);
		collections.delete(row.key);
	}
	for (const [key, spec] of specs) merged.push({ key, visible: true, spec });
	for (const [key, collection] of collections) merged.push({ key, visible: false, collection });
	return merged;
}

/** What the page shows: the visible rails, without a collection that isn't published. */
export const visibleRails = (page: PardaPage, curation: Curation) =>
	mergedRails(page, curation).filter((rail) => rail.visible && (!rail.collection || rail.collection.published));

export type SlotState = "live" | "scheduled" | "ended";

/** Dates are whole days, both ends included, and either may be open. */
export function slotState(
	slot: { startsOn: string | null; endsOn: string | null },
	today: string = pardaToday(),
): SlotState {
	if (slot.startsOn && slot.startsOn > today) return "scheduled";
	if (slot.endsOn && slot.endsOn < today) return "ended";
	return "live";
}

/** Today in Parda's zone: what a slot's dates are read against. */
export function pardaToday(now: Date = new Date()): string {
	return todayInZone(APP_TIME_ZONE, now);
}

/** A page's slots showing today, in the admin's order. */
export const liveBillboards = (page: PardaPage, curation: Curation, now: Date = new Date()) =>
	curation.billboards.filter((slot) => slot.page === page && slotState(slot, pardaToday(now)) === "live");
