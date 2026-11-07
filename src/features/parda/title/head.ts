import { type JsonLd, type SeoImage, seo } from "@/lib/seo";
import { PARDA_NAME, pardaHead } from "../brand";
import type { PardaImage } from "../kit/image";

/**
 * The head of a page titled by TMDB: a title, its credits, a person, a collection
 * (PLAN Task 63). Route options, so in every page's JavaScript: this module only
 * renders what the loader (`load.ts`, imported lazily) built. Without a catalogue
 * there's nothing to index, so the page is private.
 */
export type ContentHead = {
	title: string;
	description: string;
	/** De-localized, with the slug: the canonical path. */
	path: string;
	image: SeoImage | null;
	jsonLd: JsonLd;
	/** The hero picture, preloaded as the page shows it. */
	preload: PardaImage | null;
};

export function pardaContentHead(data: ContentHead | undefined) {
	if (!data) return pardaHead();
	const head = seo({
		title: data.title,
		siteName: PARDA_NAME,
		description: data.description,
		path: data.path,
		image: data.image,
		jsonLd: data.jsonLd,
	});
	const { preload } = data;
	return {
		meta: head.meta,
		links: [
			...head.links,
			...(preload
				? [
						{
							rel: "preload",
							as: "image",
							href: preload.src,
							imageSrcSet: preload.srcSet,
							imageSizes: "100vw",
							fetchPriority: "high" as const,
						},
					]
				: []),
		],
	};
}
