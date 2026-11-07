import "@tanstack/react-start/server-only";
import type {
	__Pascal__Detail,
	__Pascal__Input,
	__Pascal__Page,
{{#public}}
	__Pascal__PublicItem,
	__Pascal__PublicPage,
{{/public}}
} from "@/features/__name__/schema";
import type { __Pascal__ListInput } from "@/features/__name__/search";
import { changes } from "@/server/audit/record";
import { {{#public}}notFound, {{/public}}withAudit } from "@/server/db/crud";
{{#public}}
import type { SitemapEntry } from "@/server/seo/sitemap";
{{/public}}
import type { Services } from "@/server/services";
import * as repo from "./repository";

/**
 * What the __Title__ server functions do once the permission check and input
 * validation have passed (src/functions/__name__.ts calls these and nothing
 * else). Every change is audited in its own transaction (withAudit).
 */

type Reads = Pick<Services, "db">;

{{#localized}}
const label = (row: __Pascal__Detail) => row.title.en;
{{/localized}}
{{^localized}}
const label = (row: __Pascal__Detail) => row.title;
{{/localized}}
const target = (row: __Pascal__Detail) => ({ type: "__name__" as const, id: row.id, label: label(row) });

/** What an edit compares, and what its audit row shows (the notes count, but are left out of the row). */
const SUMMARIZED = ["title"{{#public}}, "slug", "published"{{/public}}] as const;
const COMPARED = [...SUMMARIZED, "notes"] as const;
const summary = (row: __Pascal__Detail) => ({
{{#localized}}
	title: [row.title.en, row.title.ne],
	notes: [row.notes.en, row.notes.ne],
{{/localized}}
{{^localized}}
	title: row.title,
	notes: row.notes,
{{/localized}}
{{#public}}
	slug: row.slug,
	published: row.published,
{{/public}}
});

export const list = ({ db }: Reads, input: __Pascal__ListInput): Promise<__Pascal__Page> => repo.list__Pascal__(db, input);

export const get = ({ db }: Reads, id: string): Promise<__Pascal__Detail> => repo.get__Pascal__(db, id);
{{#public}}

export const isSlugFree = ({ db }: Reads, input: { slug: string; id?: string | undefined }): Promise<boolean> =>
	repo.isSlugFree(db, input.slug, input.id);
{{/public}}

export function create({ db, actor }: Services, input: __Pascal__Input): Promise<__Pascal__Detail> {
	return withAudit(db, actor, async (tx, audit) => {
		const row = await repo.create__Pascal__(tx, input, actor.id);
		audit({ action: "__name__.create", target: target(row), after: { title: label(row) } });
		return row;
	});
}

/** Saves the edit if nobody changed the row since `updatedAt` (else a stale CONFLICT). */
export function update(
	{ db, actor }: Services,
	{ id, updatedAt, ...input }: __Pascal__Input & { id: string; updatedAt: string },
): Promise<__Pascal__Detail> {
	return withAudit(db, actor, async (tx, audit) => {
		const { row, before } = await repo.update__Pascal__(tx, id, input, updatedAt);
		const changed = changes(summary(before), summary(row), COMPARED, SUMMARIZED);
		if (changed) audit({ action: "__name__.update", target: target(row), ...changed });
		return row;
	});
}

/** Deletes one or many, one audit row each; missing ids are ignored. */
export async function remove({ db, actor }: Services, ids: ReadonlyArray<string>): Promise<{ deleted: number }> {
	const rows = await withAudit(db, actor, async (tx, audit) => {
		const deleted = await repo.delete__Pascal__(tx, ids);
		audit(
			...deleted.map((row) => ({
				action: "__name__.delete" as const,
				target: target(row),
				before: { title: label(row) },
			})),
		);
		return deleted;
	});
	return { deleted: rows.length };
}
{{#public}}

// Public reads (/__name__): no actor, published rows only.

const WHAT_PUBLIC = "__Title__ page";

export const listPublished = ({ db }: Reads, input: { q: string; page: number }, pageSize: number): Promise<__Pascal__PublicPage> =>
	repo.listPublished__Pascal__(db, input, pageSize);

/** Missing and draft slugs are both NOT_FOUND. */
export async function getPublished({ db }: Reads, slug: string): Promise<__Pascal__PublicItem> {
	const item = await repo.getPublished__Pascal__(db, slug);
	if (!item) throw notFound(WHAT_PUBLIC);
	return item;
}

/** The public pages, for the sitemap (src/server/seo/sitemap.ts). */
export async function sitemapEntries({ db }: Reads): Promise<SitemapEntry[]> {
	const pages = await repo.published__Pascal__Slugs(db);
	return [{ path: "/__name__" }, ...pages.map((page) => ({ path: `/__name__/${page.slug}`, lastmod: page.updatedAt }))];
}
{{/public}}
