import { CloudImage } from "@/features/attachments/components/cloud-image";
import { cn } from "../../lib/cn";
import type { Cover } from "../../types";
import type { ReliefPreset } from "./relief";
import { Relief } from "./relief";

type ProjectMountainProps = {
	cover: Cover;
	/** "wide" for full-bleed frames (the case study), "cover" for the 4:5 and 3:2 ones. */
	preset?: Extract<ReliefPreset, "cover" | "wide">;
	/** `sizes` for the uploaded cover image, when there is one. */
	sizes?: string;
	/** Set on the first screen's picture only. */
	priority?: boolean;
	className?: string | undefined;
};

/**
 * A project's picture: its uploaded cover when it has one, otherwise its own
 * mountain, grown from its art seed in the landform of its motif (terraces,
 * a lone peak, foothills, a massif, a summit, a glacier valley, a pass), under
 * a daytime sky, with its glyph where a map would print the sheet's name.
 * Fills its frame (MountainFrame).
 */
export function ProjectMountain({ cover, preset = "cover", sizes, priority = false, className }: ProjectMountainProps) {
	if (cover.image) {
		return (
			<CloudImage
				image={cover.image}
				variant="cover"
				sizes={sizes}
				loading={priority ? "eager" : "lazy"}
				fetchPriority={priority ? "high" : undefined}
				className={cn("absolute inset-0 size-full object-cover", className)}
			/>
		);
	}
	return (
		<div aria-hidden className={cn("hm-sky absolute inset-0 bg-(--hm-sky-2)", className)} data-phase="day">
			<span className="absolute top-[6%] left-[7%] font-hm-display font-bold text-[clamp(1.25rem,11cqi,4rem)] text-(--hm-on-sky) leading-none">
				{cover.glyph}
			</span>
			<Relief seed={cover.seed} landform={cover.motif} preset={preset} />
		</div>
	);
}
