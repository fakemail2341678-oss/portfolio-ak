import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";
import type { Sky as SkyState } from "../../lib/daylight";
import { Relief } from "./relief";
import { Sky } from "./sky";

type HeroRangeProps = {
	/** The range is generated from this (the owner's initials: everyone's range is their own). */
	seed: string;
	sky: SkyState;
	className?: string | undefined;
};

/**
 * The hero's picture: the sky over Kathmandu at this hour behind the range,
 * printed sheet by sheet on load; scrolling spreads the sheets apart, and the
 * cursor moves them by depth (drift.ts, loaded after hydration).
 */
export function HeroRange({ seed, sky, className }: HeroRangeProps) {
	const range = useRef<HTMLDivElement>(null);
	useEffect(() => {
		let stop: (() => void) | undefined;
		let cancelled = false;
		void import("./drift").then(({ startDrift }) => {
			if (!cancelled && range.current) stop = startDrift(range.current);
		});
		return () => {
			cancelled = true;
			stop?.();
		};
	}, []);

	return (
		<div
			ref={range}
			className={cn("hm-sky relative overflow-clip", className)}
			data-phase={sky.phase}
			data-glow={sky.alpenglow ? "" : undefined}
		>
			<Sky sky={sky} />
			<Relief seed={seed} landform="range" preset="hero" depths={3} print />
		</div>
	);
}
