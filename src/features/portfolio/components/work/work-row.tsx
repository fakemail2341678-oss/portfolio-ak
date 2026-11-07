import { Link } from "@tanstack/react-router";
import { formatNumber } from "@/lib/i18n/intl";
import { DISCIPLINE_LABELS } from "../../lib/labels";
import type { ProjectSummary } from "../../types";
import { MountainFrame } from "../art/mountain-frame";
import { ProjectMountain } from "../art/project-mountain";

/**
 * One project in the work index: its mountain (or cover), its title in display
 * type, the client and year, the disciplines and the one-line summary. The
 * whole row is the link; the mountain morphs into the case study's.
 */
export function WorkRow({ project }: { project: ProjectSummary }) {
	return (
		<li lang={project.lang} className="hm-reveal">
			<Link
				to="/work/$slug"
				params={{ slug: project.slug }}
				viewTransition
				className="hm-focus group hm-grid items-center gap-y-5 py-7"
			>
				<MountainFrame transitionSlug={project.slug} aspect="landscape" zoom className="col-span-4 md:col-span-4">
					<ProjectMountain cover={project.cover} sizes="(min-width: 48rem) 30vw, 100vw" />
				</MountainFrame>
				<div className="col-span-4 flex flex-col gap-3 md:col-span-7 md:col-start-6">
					<h2 className="hm-display text-hm-head decoration-[0.06em] decoration-hm-accent underline-offset-[0.12em] group-hover:underline">
						{project.title}
					</h2>
					<p className="text-hm-body text-hm-muted">
						{project.client}, {formatNumber(project.year, { useGrouping: false })}.{" "}
						{project.disciplines.map((discipline) => DISCIPLINE_LABELS[discipline]()).join(", ")}
					</p>
					<p className="hm-measure text-hm-body">{project.summary}</p>
				</div>
			</Link>
		</li>
	);
}
