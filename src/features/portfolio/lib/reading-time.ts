/** Typical silent reading speed for screen text, in words per minute. */
const WORDS_PER_MINUTE = 220;

/** Whole minutes to read an article body (rich-text HTML), at least one. */
export const readingMinutes = (html: string): number => {
	const words = html
		.replace(/<[^>]*>/g, " ")
		.replace(/&[a-z]+;|&#\d+;/gi, " ")
		.split(/\s+/)
		.filter((word) => word.length > 0).length;
	return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
};
