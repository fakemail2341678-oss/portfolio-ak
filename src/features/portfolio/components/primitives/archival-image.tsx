import { ARCHIVE, type ArchiveKey } from "../../lib/archive";
import { cn } from "../../lib/cn";
import { cssVars } from "../../lib/css-vars";

type ArchivalFigureProps = {
	picture: ArchiveKey;
	/** The frame's shape; the picture is cropped to fill it (object-fit: cover). */
	aspect?: string;
	/** A taller crop for phones, where a wide panorama would shrink to a strip. */
	phoneAspect?: string;
	/** Where the crop centres, as CSS object-position. */
	position?: string;
	sizes: string;
	/** Show the caption under the picture. */
	captioned?: boolean;
	className?: string | undefined;
};

/**
 * An archival picture (lib/archive.ts) in the design's two inks (hm-duotone),
 * in a frame of fixed shape so it reserves its space. Lazy: none of them is
 * on the first screen.
 */
export function ArchivalFigure({
	picture,
	aspect,
	phoneAspect,
	position = "50% 50%",
	sizes,
	captioned = true,
	className,
}: ArchivalFigureProps) {
	const item = ARCHIVE[picture];
	const [small, large] = item.widths;
	const src = (width: number) => `/himal/${item.file}-${width}.webp`;
	return (
		<figure className={cn("flex flex-col gap-3", className)}>
			<div
				className="hm-duotone aspect-(--hm-aspect-phone) md:aspect-(--hm-aspect)"
				style={cssVars({
					"--hm-aspect": aspect ?? `${item.width} / ${item.height}`,
					"--hm-aspect-phone": phoneAspect ?? aspect ?? `${item.width} / ${item.height}`,
				})}
			>
				<img
					src={src(large)}
					srcSet={`${src(small)} ${small}w, ${src(large)} ${large}w`}
					sizes={sizes}
					width={item.width}
					height={item.height}
					alt={item.alt()}
					loading="lazy"
					decoding="async"
					className="hm-settle"
					style={{ objectPosition: position }}
				/>
			</div>
			{captioned ? <figcaption className="hm-meta">{item.caption()}</figcaption> : null}
		</figure>
	);
}
