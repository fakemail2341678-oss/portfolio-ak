import "@tanstack/react-start/server-only";
import { and, asc, count, desc, eq, gte, lt, type SQL, sql } from "drizzle-orm";
import {
	type PardaListKind,
	type PardaMedia,
	type PardaRatingValue,
	pdContinueState,
	pdFavouritePerson,
	pdListItem,
	pdProgress,
	pdRating,
	pdTitle,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * My List, ♥, favourite people, likes and History (decision 0240). Every query is scoped
 * to one profile; the service resolved that profile from the session.
 */

const titleOf = (media: PardaMedia, id: number) => and(eq(pdListItem.media, media), eq(pdListItem.tmdbId, id));

export async function addToList(db: Db | Tx, profileId: string, kind: PardaListKind, media: PardaMedia, id: number) {
	await db.insert(pdListItem).values({ profileId, kind, media, tmdbId: id }).onConflictDoNothing();
}

export async function removeFromList(
	db: Db | Tx,
	profileId: string,
	kind: PardaListKind,
	media: PardaMedia,
	id: number,
) {
	await db
		.delete(pdListItem)
		.where(and(eq(pdListItem.profileId, profileId), eq(pdListItem.kind, kind), titleOf(media, id)));
}

/** The profile's list keys, latest first, at most `limit`. */
export const listKeys = (db: Db | Tx, profileId: string, kind: PardaListKind, limit: number) =>
	db
		.select({ media: pdListItem.media, id: pdListItem.tmdbId })
		.from(pdListItem)
		.where(and(eq(pdListItem.profileId, profileId), eq(pdListItem.kind, kind)))
		.orderBy(desc(pdListItem.addedAt))
		.limit(limit);

export type ListPageQuery = {
	kind: PardaListKind;
	media: PardaMedia | null;
	sort: "added" | "title" | "year";
	locale: "en" | "ne";
	page: number;
	pageSize: number;
};

/**
 * A page of the profile's list, named from `pd_title` (an add fills it in). A row
 * `pd_title` doesn't know is left out (it can't be named).
 */
export async function listPage(db: Db | Tx, profileId: string, query: ListPageQuery) {
	const filters: SQL[] = [eq(pdListItem.profileId, profileId), eq(pdListItem.kind, query.kind)];
	if (query.media) filters.push(eq(pdListItem.media, query.media));
	const where = and(...filters);
	const name = sql<string>`coalesce(nullif(${pdTitle.title}->>${query.locale}, ''), ${pdTitle.title}->>'en')`;
	const order =
		query.sort === "title"
			? [asc(sql`lower(${name})`), desc(pdListItem.addedAt)]
			: query.sort === "year"
				? [sql`${pdTitle.year} desc nulls last`, desc(pdListItem.addedAt)]
				: [desc(pdListItem.addedAt)];
	const join = and(eq(pdTitle.media, pdListItem.media), eq(pdTitle.tmdbId, pdListItem.tmdbId));
	const [rows, [total]] = await Promise.all([
		db
			.select({
				media: pdListItem.media,
				id: pdListItem.tmdbId,
				title: pdTitle.title,
				year: pdTitle.year,
				poster: pdTitle.poster,
				backdrop: pdTitle.backdrop,
				genres: pdTitle.genres,
			})
			.from(pdListItem)
			.innerJoin(pdTitle, join)
			.where(where)
			.orderBy(...order, asc(pdListItem.id))
			.limit(query.pageSize)
			.offset((query.page - 1) * query.pageSize),
		db.select({ value: count() }).from(pdListItem).innerJoin(pdTitle, join).where(where),
	]);
	return { rows, total: total?.value ?? 0 };
}

export async function favouritePerson(
	db: Db | Tx,
	profileId: string,
	person: { id: number; name: string; portrait: string | null },
) {
	await db
		.insert(pdFavouritePerson)
		.values({ profileId, personId: person.id, name: person.name, portrait: person.portrait })
		.onConflictDoNothing();
}

export async function unfavouritePerson(db: Db | Tx, profileId: string, personId: number) {
	await db
		.delete(pdFavouritePerson)
		.where(and(eq(pdFavouritePerson.profileId, profileId), eq(pdFavouritePerson.personId, personId)));
}

export const favouritePeople = (db: Db | Tx, profileId: string, limit: number) =>
	db
		.select()
		.from(pdFavouritePerson)
		.where(eq(pdFavouritePerson.profileId, profileId))
		.orderBy(desc(pdFavouritePerson.addedAt))
		.limit(limit);

export async function setRating(
	db: Db | Tx,
	profileId: string,
	media: PardaMedia,
	id: number,
	value: PardaRatingValue | null,
) {
	const where = and(eq(pdRating.profileId, profileId), eq(pdRating.media, media), eq(pdRating.tmdbId, id));
	if (value === null) {
		await db.delete(pdRating).where(where);
		return;
	}
	await db
		.insert(pdRating)
		.values({ profileId, media, tmdbId: id, value })
		.onConflictDoUpdate({
			target: [pdRating.profileId, pdRating.media, pdRating.tmdbId],
			set: { value, ratedAt: sql`now()` },
		});
}

export const ratings = (db: Db | Tx, profileId: string, value: PardaRatingValue, limit: number) =>
	db
		.select({ media: pdRating.media, id: pdRating.tmdbId })
		.from(pdRating)
		.where(and(eq(pdRating.profileId, profileId), eq(pdRating.value, value)))
		.orderBy(desc(pdRating.ratedAt))
		.limit(limit);

/** History's rows: every movie and episode the profile played or marked, latest first, a page at a time. */
export const historyRows = (db: Db | Tx, profileId: string, limit: number, offset: number) =>
	db
		.select()
		.from(pdProgress)
		.where(eq(pdProgress.profileId, profileId))
		.orderBy(desc(pdProgress.updatedAt), asc(pdProgress.id))
		.limit(limit)
		.offset(offset);

/** Removes a title's day from History: its rows written between `from` and `to`. */
export async function deleteHistory(
	db: Db | Tx,
	profileId: string,
	media: PardaMedia,
	id: number,
	from: Date,
	to: Date,
): Promise<number> {
	const rows = await db
		.delete(pdProgress)
		.where(
			and(
				eq(pdProgress.profileId, profileId),
				eq(pdProgress.media, media),
				eq(pdProgress.tmdbId, id),
				gte(pdProgress.updatedAt, from),
				lt(pdProgress.updatedAt, to),
			),
		)
		.returning({ id: pdProgress.id });
	return rows.length;
}

/** Clears History: every progress row, and what Continue watching kept per title. */
export async function clearHistory(db: Db, profileId: string) {
	await db.transaction(async (tx) => {
		await tx.delete(pdProgress).where(eq(pdProgress.profileId, profileId));
		await tx.delete(pdContinueState).where(eq(pdContinueState.profileId, profileId));
	});
}

/** A title's snapshot, written when it's saved, so a list can be named and sorted without TMDB. */
export async function rememberTitle(db: Db | Tx, row: typeof pdTitle.$inferInsert) {
	await db
		.insert(pdTitle)
		.values(row)
		.onConflictDoUpdate({
			target: [pdTitle.media, pdTitle.tmdbId],
			// The daily refresh owns the rank; a save fills the rest in.
			set: {
				title: sql`excluded.title`,
				poster: sql`excluded.poster`,
				backdrop: sql`excluded.backdrop`,
				year: sql`excluded.year`,
				genres: sql`excluded.genres`,
				runtime: sql`excluded.runtime`,
				certification: sql`excluded.certification`,
				certificationCheckedAt: sql`excluded.certification_checked_at`,
			},
		});
}

/** Moves one profile's saved rows to another (a guest's claim): rows both have stay as the target had them. */
export async function mergeSaved(tx: Tx, fromProfileId: string, toProfileId: string) {
	await tx.execute(sql`
		insert into ${pdListItem} (profile_id, kind, media, tmdb_id, added_at)
		select ${toProfileId}, kind, media, tmdb_id, added_at from ${pdListItem} where profile_id = ${fromProfileId}
		on conflict (profile_id, kind, media, tmdb_id) do nothing`);
	await tx.execute(sql`
		insert into ${pdFavouritePerson} (profile_id, person_id, name, portrait, added_at)
		select ${toProfileId}, person_id, name, portrait, added_at from ${pdFavouritePerson} where profile_id = ${fromProfileId}
		on conflict (profile_id, person_id) do nothing`);
	await tx.execute(sql`
		insert into ${pdRating} (profile_id, media, tmdb_id, value, rated_at)
		select ${toProfileId}, media, tmdb_id, value, rated_at from ${pdRating} where profile_id = ${fromProfileId}
		on conflict (profile_id, media, tmdb_id) do update set value = excluded.value, rated_at = excluded.rated_at
		where excluded.rated_at > ${pdRating}.rated_at`);
}
