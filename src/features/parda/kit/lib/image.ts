/**
 * A TMDB image as the kit renders it: a default `src`, a width-described `srcSet`, and
 * the aspect as `width`/`height` (2:3 or 16:9), so the box is sized before the file
 * arrives and nothing shifts.
 */
export type PardaImage = { src: string; srcSet: string; width: number; height: number };

/** TMDB's own sizes per kind (its configuration endpoint lists them; they've been stable for years). */
const SIZES = {
	poster: { widths: [154, 342, 500, 780], src: 342, width: 2, height: 3 },
	backdrop: { widths: [300, 780, 1280], src: 780, width: 16, height: 9 },
	still: { widths: [185, 300], src: 300, width: 16, height: 9 },
	profile: { widths: [185], src: 185, width: 2, height: 3 },
} as const;

export type TmdbImageKind = keyof typeof SIZES;

/**
 * Built where it's rendered, from TMDB's file path and the image base the server sends
 * once per answer (decision 0234): a rail of twenty titles then carries twenty short
 * paths in the page's HTML, not twenty srcsets.
 */
export function tmdbImage(imageBase: string, path: string | null | undefined, kind: TmdbImageKind): PardaImage | null {
	if (!path) return null;
	const { widths, src, width, height } = SIZES[kind];
	const base = imageBase.replace(/\/$/, "");
	return {
		src: `${base}/w${src}${path}`,
		srcSet: widths.map((size) => `${base}/w${size}${path} ${size}w`).join(", "),
		width,
		height,
	};
}
