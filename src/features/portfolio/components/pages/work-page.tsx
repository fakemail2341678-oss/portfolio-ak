import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { DISCIPLINES, type Discipline } from "../../constants";
import { DISCIPLINE_LABELS } from "../../lib/labels";
import { workQueryOptions } from "../../queries";
import { PanoramaBoard } from "../art/panorama-board";
import { SectionHeading } from "../primitives/section-heading";
import { WorkRow } from "../work/work-row";

const route = getRouteApi("/_site/work/");

const filterLink =
	"hm-focus inline-flex min-h-11 items-center gap-2 px-4 font-medium transition-colors duration-(--hm-dur-1) " +
	"bg-hm-ground-2 decoration-[0.06em] underline-offset-[0.2em] hover:underline aria-[current=page]:bg-hm-ink aria-[current=page]:text-hm-ground";

/** /work: the panorama of every project, then the archive, filterable by discipline (links: it works without JavaScript). */
export function WorkPage() {
	const { discipline } = route.useSearch();
	const { data: all } = useSuspenseQuery(workQueryOptions());
	const projects = discipline ? all.filter((project) => project.disciplines.includes(discipline)) : all;
	const years = all.map((project) => project.year);
	const countOf = (value: Discipline) => all.filter((project) => project.disciplines.includes(value)).length;
	const year = (value: number) => formatNumber(value, { useGrouping: false });

	return (
		<>
			<header className="hm-container pt-[clamp(2.5rem,6vw,5rem)] pb-[clamp(2.5rem,5vw,4rem)]">
				<SectionHeading
					as="h1"
					size="title"
					id="work-title"
					title={
						years.length > 0
							? m.portfolio_work_heading_years({ from: year(Math.min(...years)), to: year(Math.max(...years)) })
							: m.portfolio_work_title()
					}
					intro={m.portfolio_work_description()}
				/>
			</header>
			<PanoramaBoard projects={all} />
			<div className="hm-container pt-[clamp(3rem,6vw,5rem)] pb-[clamp(5rem,10vw,9rem)]">
				<nav aria-label={m.portfolio_work_filter_label()} className="mb-8">
					<ul className="flex flex-wrap gap-2">
						<li>
							<Link to="/work" search={{}} className={filterLink} aria-current={discipline ? undefined : "page"}>
								{m.portfolio_work_filter_all()}
								<span>{formatNumber(all.length)}</span>
							</Link>
						</li>
						{DISCIPLINES.map((value) => (
							<li key={value}>
								<Link
									to="/work"
									search={{ discipline: value }}
									className={filterLink}
									aria-current={discipline === value ? "page" : undefined}
								>
									{DISCIPLINE_LABELS[value]()}
									<span>{formatNumber(countOf(value))}</span>
								</Link>
							</li>
						))}
					</ul>
				</nav>
				<p className="sr-only" aria-live="polite">
					{m.portfolio_work_count({ count: formatNumber(projects.length) })}
				</p>
				<ul className="flex flex-col gap-4">
					{projects.map((project) => (
						<WorkRow key={project.slug} project={project} />
					))}
				</ul>
			</div>
		</>
	);
}
