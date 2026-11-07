import { formatNumber } from "@/lib/i18n/intl";
import type { Project } from "../../types";
import { MountainFrame } from "../art/mountain-frame";
import { ProjectMountain } from "../art/project-mountain";

type CaseStudyHeroProps = {
	project: Pick<Project, "slug" | "title" | "client" | "year" | "summary" | "cover">;
};

/**
 * The opening of a case study: the title, the client and year, the one-line
 * summary, then the project's mountain (or cover) across the page, morphing in
 * from the index (same transition name).
 */
export function CaseStudyHero({ project }: CaseStudyHeroProps) {
	return (
		<header className="pt-[clamp(2rem,5vw,4rem)]">
			<div className="hm-container flex flex-col gap-6">
				<h1 id="case-title" className="hm-display text-hm-title">
					{project.title}
				</h1>
				<div className="hm-grid gap-y-4">
					<p className="col-span-4 font-medium text-hm-lead md:col-span-4">
						{project.client}, {formatNumber(project.year, { useGrouping: false })}
					</p>
					<p className="col-span-4 text-hm-lead md:col-span-7 md:col-start-6">{project.summary}</p>
				</div>
			</div>
			<MountainFrame transitionSlug={project.slug} aspect="wide" className="mt-[clamp(2.5rem,5vw,4rem)]">
				<ProjectMountain cover={project.cover} preset="wide" sizes="100vw" priority />
			</MountainFrame>
		</header>
	);
}
