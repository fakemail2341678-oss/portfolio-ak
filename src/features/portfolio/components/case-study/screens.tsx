import { CloudImage } from "@/features/attachments/components/cloud-image";
import type { ImageAsset } from "@/features/attachments/schema";
import { cn } from "../../lib/cn";
import type { Cover } from "../../types";
import { MountainFrame } from "../art/mountain-frame";
import { ProjectMountain } from "../art/project-mountain";

type ScreensProps = {
	captions: ReadonlyArray<string>;
	/** The project's gallery images for these captions, in order (fewer when not all are uploaded). */
	images: ReadonlyArray<ImageAsset>;
	/** The project's cover: a screen without an image shows a plate of its landform instead. */
	cover: Cover;
};

/**
 * A case study's "Screens" block: each caption with its picture from the
 * project's gallery. Where no screenshot is uploaded yet, a plate of the
 * project's landform (seeded per screen) holds its place, so the layout is
 * the same before and after the owner adds them.
 */
export function Screens({ captions, images, cover }: ScreensProps) {
	return (
		<ul className="grid grid-cols-1 gap-(--hm-gutter) md:grid-cols-2">
			{captions.map((caption, screen) => {
				const image = images[screen];
				return (
					<li key={caption} className={cn(captions.length % 2 === 1 && screen === 0 && "md:col-span-2")}>
						<figure className="flex flex-col gap-3">
							<MountainFrame aspect="landscape">
								{image ? (
									<CloudImage
										image={image}
										variant="cover"
										sizes="(min-width: 48rem) 45vw, 100vw"
										loading="lazy"
										className="absolute inset-0 size-full object-cover"
									/>
								) : (
									<ProjectMountain cover={{ ...cover, seed: `${cover.seed}-${screen + 1}`, glyph: "", image: null }} />
								)}
							</MountainFrame>
							<figcaption className="hm-meta">{caption}</figcaption>
						</figure>
					</li>
				);
			})}
		</ul>
	);
}
