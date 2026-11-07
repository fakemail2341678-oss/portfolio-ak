/** URL slugs: lowercase ASCII words joined by single hyphens ("hello-world"). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The longest slug `slugify` makes by default. */
export const SLUG_MAX = 80;

/** Lowercase ASCII slug from a title ("Hello, World!" -> "hello-world"), at most `max` characters; "" for non-Latin titles. */
export const slugify = (title: string, max = SLUG_MAX) =>
	title
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, max)
		.replace(/-+$/g, "");
