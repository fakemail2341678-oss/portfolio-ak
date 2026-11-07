import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const ASPECTS = {
	portrait: "aspect-[4/5]",
	landscape: "aspect-[3/2]",
	wide: "aspect-[21/9]",
	square: "aspect-square",
} as const;

export type FrameAspect = keyof typeof ASPECTS;

type MountainFrameProps = {
	/**
	 * Shared-element name: the same slug on the work index and on the case study
	 * lets the browser morph one into the other (a View Transition). Only one
	 * element per page may use a given slug.
	 */
	transitionSlug?: string | undefined;
	aspect?: FrameAspect;
	/** Zoom the picture slightly on hover or focus of the enclosing link. */
	zoom?: boolean;
	className?: string | undefined;
	children: ReactNode;
};

/** A fixed-ratio, clipped frame for a project's mountain or cover: it reserves its space, so nothing shifts. */
export function MountainFrame({
	transitionSlug,
	aspect = "landscape",
	zoom = false,
	className,
	children,
}: MountainFrameProps) {
	return (
		<div
			className={cn("@container relative overflow-clip bg-hm-ground-2", ASPECTS[aspect], zoom && "hm-zoom", className)}
			style={transitionSlug ? { viewTransitionName: `hm-frame-${transitionSlug}` } : undefined}
			data-hm-frame={transitionSlug ? "" : undefined}
		>
			{children}
		</div>
	);
}
