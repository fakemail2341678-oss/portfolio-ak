import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { cn } from "../../lib/cn";
import type { ProjectSummary } from "../../types";
import { MountainFrame } from "../art/mountain-frame";
import { ProjectMountain } from "../art/project-mountain";
import { TextLink } from "../primitives/links";
import { SectionHeading } from "../primitives/section-heading";

type SelectedWorkSectionProps = {
	projects: ReadonlyArray<ProjectSummary>;
	/** Size of the whole archive, for the "All work" link. */
	total: number;
};

const year = (value: number) => formatNumber(value, { useGrouping: false });

/**
 * The featured work, by name: every title is on the page at once, in the
 * section's quieter ink, and the one under the pointer or the focus is struck
 * forward in full ink while its mountain fills the frame beside the list.
 * Without JavaScript each name is still a link and the first mountain shows.
 * On phones each name has its own mountain above it.
 */
export function SelectedWorkSection({ projects, total }: SelectedWorkSectionProps) {
	const [active, setActive] = useState(0);
	const current = projects[active] ?? projects[0];
	if (!current) return null;
	return (
		<section id="work" aria-labelledby="work-title" className="hm-field-ridge hm-section">
			<div className="hm-container hm-grid gap-y-14">
				<SectionHeading id="work-title" title={m.portfolio_chapter_work()} className="col-span-4 md:col-span-12" />
				<ul className="col-span-4 flex flex-col gap-14 md:col-span-7 md:gap-5">
					{projects.map((project, index) => (
						<li key={project.slug} lang={project.lang}>
							<Link
								to="/work/$slug"
								params={{ slug: project.slug }}
								viewTransition
								className="hm-focus group block"
								onPointerEnter={() => setActive(index)}
								onFocus={() => setActive(index)}
							>
								<MountainFrame transitionSlug={project.slug} aspect="landscape" className="mb-5 md:hidden">
									<ProjectMountain cover={project.cover} sizes="100vw" />
								</MountainFrame>
								<h3
									className={cn(
										"hm-display text-hm-head transition-colors duration-(--hm-dur-2)",
										index === active ? "md:text-hm-ink" : "md:text-hm-muted",
									)}
								>
									{project.title}
								</h3>
								<span className="mt-2 block text-hm-body text-hm-muted">
									{project.client}, {year(project.year)}
								</span>
							</Link>
						</li>
					))}
				</ul>
				<div aria-hidden className="hidden md:col-span-4 md:col-start-9 md:block">
					<div className="sticky top-[10vh] flex flex-col gap-5">
						<MountainFrame key={current.slug} transitionSlug={current.slug} aspect="portrait" className="hm-preview-in">
							<ProjectMountain cover={current.cover} sizes="30vw" />
						</MountainFrame>
						<p lang={current.lang} className="text-hm-body">
							{current.summary}
						</p>
					</div>
				</div>
				<p className="col-span-4 text-hm-lead md:col-span-12">
					<TextLink to="/work">{m.portfolio_work_all({ count: formatNumber(total) })}</TextLink>
				</p>
			</div>
		</section>
	);
}
