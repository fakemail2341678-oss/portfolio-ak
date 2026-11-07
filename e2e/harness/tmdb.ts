/**
 * Stands in for TMDB in e2e (decision 0229): `/tmdb/3/<path>` answers from
 * tests/fixtures/tmdb, and `/tmdb/img/...` with a small placeholder image.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { titleSlug } from "../../src/features/parda/slug.ts";

const FIXTURES = path.resolve(import.meta.dirname, "../../tests/fixtures/tmdb");
const PLACEHOLDER =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 3"><rect width="2" height="3" fill="#444"/></svg>';

/** Parameters that don't change which answer a request gets (the language is the file's suffix). */
const IGNORED = new Set(["language", "include_adult", "page", "append_to_response", "include_image_language"]);

/**
 * A recorded answer's file name, shared by `pnpm tmdb:record`, this stand-in and the
 * tests (decision 0234): the path, then each parameter that picks the answer, so two
 * discover queries on one path get two files. A date's value is left out ("aired
 * today" changes daily), so a recording keeps answering later.
 *
 *   discover/tv?with_genres=16&air_date.gte=2026-11-04, ne-NP
 *   -> discover_tv+air_date.gte+with_genres=16.ne-NP.json
 */
export function fixtureName(pathname: string, params: Iterable<[string, string]>, language: string): string {
	const parts = [...params]
		.filter(([key]) => !IGNORED.has(key))
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => (key.includes("date") ? key : `${key}=${value}`).replace(/[^\w.=-]/g, "_"));
	const base = pathname
		.replace(/^\//, "")
		.replaceAll("/", "_")
		.replace(/[^\w-]/g, "");
	return `${[base, ...parts].join("+")}.${language.replace(/[^\w-]/g, "")}.json`;
}

/** A recorded answer, or undefined when there's none. */
export function readFixture(name: string): string | undefined {
	const file = path.join(FIXTURES, name);
	return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

type FixtureItem = {
	id: number;
	title?: string;
	name?: string;
	media_type?: string;
	backdrop_path?: string | null;
	adult?: boolean;
	softcore?: boolean;
};

const readJson = <T>(name: string): T => {
	const body = readFixture(name);
	if (body === undefined) throw new Error(`tests/fixtures/tmdb/${name}: missing; run pnpm tmdb:record`);
	return JSON.parse(body) as T;
};

const titlePath = (media: string, item: FixtureItem) => {
	const name = (media === "movie" ? item.title : item.name) ?? "";
	const slug = titleSlug(name);
	return `/app/parda/${media === "movie" ? "movie" : "series"}/${slug ? `${item.id}-${slug}` : item.id}`;
};

/**
 * The first title of the home's billboard (trending this week, with a backdrop), at its
 * canonical address: the recording always holds its details, so a flow opens its page.
 */
export function fixtureTitlePath(): string {
	const list = readJson<{ results?: FixtureItem[] }>(fixtureName("trending/all/week", [], "en-US"));
	const first = list.results?.find(
		(item) =>
			(item.media_type === "movie" || item.media_type === "tv") && item.backdrop_path && !item.adult && !item.softcore,
	);
	if (!first) throw new Error("tests/fixtures/tmdb: no trending title to review; run pnpm tmdb:record");
	return titlePath(first.media_type ?? "movie", first);
}

/** A page of each kind the review opens (PLAN Task 63), from what `pnpm tmdb:record` always records. */
export type PardaFixturePage =
	| "movie"
	| "series"
	| "credits"
	| "person"
	| "collection"
	| "watch-movie"
	| "watch-series";

const popularFirst = (media: "movie" | "tv") => {
	const first = readJson<{ results?: FixtureItem[] }>(fixtureName(`${media}/popular`, [], "en-US")).results?.[0];
	if (!first) throw new Error(`tests/fixtures/tmdb: ${media}/popular is empty; run pnpm tmdb:record`);
	return first;
};

/** The popular list's title at `index` (0 is the one the review opens): its id and its page. */
export function popularFixture(media: "movie" | "tv", index: number): { id: number; path: string } {
	const item = readJson<{ results?: FixtureItem[] }>(fixtureName(`${media}/popular`, [], "en-US")).results?.[index];
	if (!item) throw new Error(`tests/fixtures/tmdb: ${media}/popular has no title ${index}; run pnpm tmdb:record`);
	return { id: item.id, path: titlePath(media, item) };
}

export function pardaFixturePath(page: PardaFixturePage): string {
	if (page === "movie") return titlePath("movie", popularFirst("movie"));
	if (page === "series") return titlePath("tv", popularFirst("tv"));
	// The watch page (Task 64): a series without ?s=&e= plays its first episode, which is recorded.
	if (page === "watch-movie")
		return titlePath("movie", popularFirst("movie")).replace("/app/parda/", "/app/parda/watch/");
	if (page === "watch-series") return titlePath("tv", popularFirst("tv")).replace("/app/parda/", "/app/parda/watch/");
	if (page === "credits") return `${titlePath("tv", popularFirst("tv"))}/credits`;
	if (page === "person") {
		const id = popularFirst("movie").id;
		const details = readJson<{ credits?: { cast?: Array<{ id: number }> } }>(fixtureName(`movie/${id}`, [], "en-US"));
		const actor = details.credits?.cast?.[0];
		if (!actor) throw new Error(`tests/fixtures/tmdb: movie ${id} has no cast; run pnpm tmdb:record`);
		return `/app/parda/person/${actor.id}`;
	}
	const collection = readdirSync(FIXTURES).find((file) => /^collection_\d+\.en-US\.json$/.test(file));
	if (!collection) throw new Error("tests/fixtures/tmdb: no collection recorded; run pnpm tmdb:record");
	return `/app/parda/collection/${collection.replace(/\D+/g, "")}`;
}

/** Answers a stand-in request; false when the URL isn't one. */
export function serveTmdb(url: URL, response: ServerResponse): boolean {
	if (url.pathname.startsWith("/tmdb/img/")) {
		response.writeHead(200, { "content-type": "image/svg+xml" });
		response.end(PLACEHOLDER);
		return true;
	}
	if (!url.pathname.startsWith("/tmdb/3/")) return false;
	const name = fixtureName(
		url.pathname.slice("/tmdb/3/".length),
		url.searchParams,
		url.searchParams.get("language") ?? "en-US",
	);
	const body = readFixture(name);
	if (body === undefined) {
		response.writeHead(404, { "content-type": "application/json" });
		response.end('{"status_code":34}');
		return true;
	}
	response.writeHead(200, { "content-type": "application/json" });
	response.end(body);
	return true;
}
