/**
 * A title's address carries a slug after its id (/app/parda/movie/550-fight-club,
 * PLAN 12.5 and decision 0235). The id finds the title; the slug is for people and
 * search engines, so a wrong or missing one is answered with a 301 to the right one.
 * It's made from the English title in both languages, so a page has one address.
 */

const MAX_SLUG = 60;

/** "Spider-Man: Across the Spider-Verse" → "spider-man-across-the-spider-verse"; "" when nothing Latin is left. */
export function titleSlug(title: string): string {
	const slug = title
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (slug.length <= MAX_SLUG) return slug;
	const cut = slug.slice(0, MAX_SLUG);
	const dash = cut.lastIndexOf("-");
	return (dash > MAX_SLUG / 2 ? cut.slice(0, dash) : cut).replace(/-+$/, "");
}

/** The `$id` segment: "550-fight-club", or "550" for a title without a Latin name. */
export const titleParam = (id: number, slug: string) => (slug ? `${id}-${slug}` : String(id));

const PARAM = /^([1-9]\d{0,9})(?:-([a-z0-9-]*))?$/;

/** The id and slug in a `$id` segment, or null when it isn't one (a 404). */
export function parseTitleParam(param: string): { id: number; slug: string } | null {
	const match = PARAM.exec(param);
	if (!match?.[1]) return null;
	const id = Number(match[1]);
	if (id > 2_147_483_647) return null;
	return { id, slug: match[2] ?? "" };
}
