import { Link } from "@tanstack/react-router";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "../../lib/cn";
import { panorama } from "../../lib/terrain/panorama";
import type { ProjectSummary } from "../../types";
import { Relief } from "./relief";

/** A viewpoint board's leader line, from a summit's name down to the summit: part of the picture. */
const LEADER_LINE = "mt-1 w-0.5 flex-1 bg-(--hm-on-sky)"; // taste-skill-ignore: a leader line in the drawing, not a divider

/** The share of the board above the drawing, where the names stand. */
const LABEL_BAND = 22;

/**
 * The work index's picture: the range printed like the hero's, every
 * published project one summit of the crest, named on a board above it with
 * a leader line down to its snow, the way viewpoint boards and Sella's
 * panoramas name the Himalaya. A picture for pointer users: the names are
 * links but out of the tab order and hidden from assistive technology, which
 * get the same projects as the list below it. Labels show from tablets up.
 */
export function PanoramaBoard({
	projects,
	className,
}: {
	projects: ReadonlyArray<Pick<ProjectSummary, "slug" | "title" | "year">>;
	className?: string | undefined;
}) {
	const board = panorama(projects.map((project) => project.slug));
	return (
		// The drawing fills the board below the names at its own shape (1600 × 452), so the summits land where the lines point.
		<div aria-hidden className={cn("relative aspect-[1600/580] bg-(--hm-sky-day-2)", className)}>
			<Relief model={board.relief} fit="none" className="top-[22%]" />
			<ul className="absolute inset-0 hidden md:block">
				{board.peaks.map((peak, index) => {
					const project = projects[index];
					if (!project) return null;
					// The line runs a little into the summit's sheet, so it visibly touches the snow.
					const summit = LABEL_BAND + peak.y * (100 - LABEL_BAND) + 1.5;
					const labelTop = index % 2 === 0 ? 3 : 10;
					return (
						<li
							key={project.slug}
							className="absolute flex -translate-x-1/2 flex-col items-center"
							style={{ left: `${peak.x * 100}%`, top: `${labelTop}%`, height: `${summit - labelTop}%` }}
						>
							<Link
								to="/work/$slug"
								params={{ slug: project.slug }}
								tabIndex={-1}
								className="max-w-[11rem] text-center font-semibold text-(--hm-on-sky) text-hm-small leading-tight hover:underline"
							>
								{project.title}
								<span className="block font-normal">{formatNumber(project.year, { useGrouping: false })}</span>
							</Link>
							<span className={LEADER_LINE} />
						</li>
					);
				})}
			</ul>
		</div>
	);
}
