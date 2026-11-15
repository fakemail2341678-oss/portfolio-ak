import { cn } from "../../lib/cn";
import type { Sky as SkyState } from "../../lib/daylight";
import { seededRandom } from "../../lib/seeded-random";

/** A fixed scatter of stars for the night sky (same on server and browser). */
const STARS = (() => {
	const random = seededRandom("himal-stars");
	return Array.from({ length: 42 }, () => ({
		x: Math.round(random.between(1, 99) * 10) / 10,
		y: Math.round(random.between(2, 52) * 10) / 10,
		r: random.chance(0.18) ? 1.6 : 0.9,
	}));
})();

/**
 * The sky behind a relief: three flat bands, never a gradient, coloured for
 * the phase of the day (himal.css, `.hm-sky[data-phase]`); the low sun near the
 * edge it rises or sets on; stars at night. Decorative.
 */
export function Sky({ sky, className }: { sky: SkyState; className?: string | undefined }) {
	return (
		<div aria-hidden className={cn("absolute inset-0 flex flex-col", className)}>
			<div className="flex-[1.6] bg-(--hm-sky-1) transition-colors duration-(--hm-dur-3)" />
			<div className="flex-1 bg-(--hm-sky-2) transition-colors duration-(--hm-dur-3)" />
			<div className="flex-[1.4] bg-(--hm-sky-3) transition-colors duration-(--hm-dur-3)" />
			{sky.phase === "night"
				? STARS.map((star) => (
						<span
							key={`${star.x}-${star.y}`}
							className="absolute rounded-full bg-(--hm-star)"
							style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.r * 2, height: star.r * 2 }}
						/>
					))
				: null}
			{sky.sun ? (
				<span
					className="absolute size-[clamp(2.5rem,6vw,5rem)] -translate-x-1/2 rounded-full bg-(--hm-sun)"
					style={{ left: `${sky.sun.x}%`, bottom: `${32 + sky.sun.y * 0.6}%` }}
				/>
			) : null}
		</div>
	);
}
