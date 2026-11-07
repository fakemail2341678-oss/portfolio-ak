import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PardaImage } from "./image";

/** The boxes pictures sit in (decision 0232): posters and people 2:3, backdrops and stills 16:9, home's screen 2.39:1. */
export const ASPECTS = {
	poster: "aspect-[2/3]",
	backdrop: "aspect-video",
	scope: "aspect-[2.39/1]",
} as const;

export type Aspect = keyof typeof ASPECTS;

/**
 * A picture from TMDB (CloudImage's srcset pattern, for images that aren't on
 * Cloudinary): the box has its aspect before the file arrives, so nothing shifts, and
 * the picture covers it to a hard edge, never tinted or faded into the page. Lazy
 * unless `priority` (the billboard's first picture).
 *
 * Without a picture, the box is a piece of mask holding `fallback` (by default the
 * title in display type), so a title without a backdrop still looks designed.
 */
export function TmdbImage({
	image,
	alt,
	aspect,
	sizes,
	priority = false,
	fallback,
	label,
	className,
}: {
	image: PardaImage | null;
	/** "" when the title is printed beside the picture (a card's caption): it would be read twice. */
	alt: string;
	aspect: Aspect;
	/** The `sizes` attribute: how wide the box is at each breakpoint. */
	sizes: string;
	priority?: boolean;
	fallback?: ReactNode;
	/** The title the empty box shows (hidden from screen readers: the caption or `alt` says it). */
	label?: string;
	className?: string;
}) {
	return (
		<div className={cn("relative overflow-hidden bg-pd-ground-2", ASPECTS[aspect], className)}>
			{image ? (
				<img
					src={image.src}
					srcSet={image.srcSet}
					sizes={sizes}
					alt={alt}
					width={image.width * 100}
					height={image.height * 100}
					loading={priority ? "eager" : "lazy"}
					decoding="async"
					{...(priority ? { fetchPriority: "high" as const } : {})}
					className="absolute inset-0 size-full object-cover"
				/>
			) : (
				<div
					{...(alt ? { role: "img", "aria-label": alt } : {})}
					className="absolute inset-0 flex items-center justify-center bg-pd-mask p-3 text-center text-pd-muted"
					data-testid="tmdb-image-missing"
				>
					{fallback ?? (
						<span aria-hidden="true" className="pd-display line-clamp-3 text-lg">
							{label}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
