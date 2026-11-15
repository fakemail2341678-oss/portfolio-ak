import { preload } from "react-dom";
import type { PardaImage } from "./image";

/**
 * Preloads a page's first picture from where it renders (decision 0245). React flushes a
 * high-priority image preload at the top of `<head>`, ahead of the modulepreloads and the
 * font preloads; a route `head()` link lands after all of them, so on a slow connection the
 * picture waited for every script. `media` keeps the other shape from downloading.
 */
export function preloadHero(image: PardaImage | null, media?: string) {
	if (!image) return;
	preload(image.src, {
		as: "image",
		imageSrcSet: image.srcSet,
		imageSizes: "100vw",
		fetchPriority: "high",
		...(media ? { media } : {}),
	});
}
