import "@tanstack/react-start/server-only";
import type { ImageAsset, ImageSource } from "@/features/attachments/schema";
import type { AttachmentRow } from "@/server/db/schema";
import type { ImageStore } from "./cloudinary";

/** srcset widths; never upscaled past the original. */
const WIDTHS = [320, 480, 640, 960, 1280, 1920] as const;
const MAX_WIDTH = 1920;
/** Format and quality chosen per browser by Cloudinary. */
const AUTO = "f_auto,q_auto";
/** Social previews: a fixed size and a format every crawler reads. */
export const OG_TRANSFORMATION = "c_fill,g_auto,w_1200,h_630,f_jpg,q_auto";

const widthsFor = (original: number) => {
	const widths = WIDTHS.filter((width) => width < original);
	return [...new Set([...widths, Math.min(original, MAX_WIDTH)])];
};

function source(
	store: ImageStore,
	row: AttachmentRow,
	original: number,
	transformation: (width: number) => string,
): ImageSource {
	const widths = widthsFor(original);
	const url = (width: number) => store.url({ publicId: row.publicId, version: row.version }, transformation(width));
	return {
		src: url(widths.find((width) => width >= 960) ?? widths[widths.length - 1] ?? original),
		srcSet: widths.map((width) => `${url(width)} ${width}w`).join(", "),
	};
}

/** The browser-facing image for an attachment row (URLs built here; see ImageAsset). */
export function toImageAsset(store: ImageStore, row: AttachmentRow): ImageAsset {
	const width = row.width ?? 1280;
	const height = row.height ?? 720;
	return {
		id: row.id,
		alt: row.alt,
		format: row.format,
		url: store.original(row),
		width,
		height,
		full: source(store, row, width, (w) => `c_limit,w_${w},${AUTO}`),
		cover: source(store, row, width, (w) => `c_fill,g_auto,ar_16:9,w_${w},${AUTO}`),
		thumb: store.url({ publicId: row.publicId, version: row.version }, `c_fill,g_auto,w_160,h_160,${AUTO}`),
		og: store.url({ publicId: row.publicId, version: row.version }, OG_TRANSFORMATION),
	};
}
