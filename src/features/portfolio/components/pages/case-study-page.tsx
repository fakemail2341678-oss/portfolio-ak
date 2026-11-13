import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, notFound } from "@tanstack/react-router";
import { appPath, isAppSlug } from "@/features/apps/registry"; // @apps
import { m } from "@/paraglide/messages";
import { projectQueryOptions } from "../../queries";
import { CaseStudyBody } from "../case-study/case-study-body";
import { CaseStudyHero } from "../case-study/case-study-hero";
import { FactSheet } from "../case-study/fact-sheet";
import { KharchaLink } from "../case-study/kharcha-link"; // @kharcha
import { NextProject } from "../case-study/next-project";
import { TasklineLink } from "../case-study/taskline-link"; // @taskline
import { DraftNotice } from "../chrome/draft-notice";
import { FigureLines } from "../primitives/figure-lines";
import { ButtonLink } from "../primitives/links"; // @apps

const route = getRouteApi("/_site/work/$slug");

/** /work/$slug: a case study (`?preview=1` shows a draft to someone who may read it). */
export function CaseStudyPage() {
	const { slug } = route.useParams();
	const { preview } = route.useLoaderDeps();
	const { data } = useSuspenseQuery(projectQueryOptions(slug, preview));
	// The loader already threw for a missing slug; this narrows the type.
	if (!data) throw notFound();
	const { project, next, draft } = data;

	return (
		<article aria-labelledby="case-title" lang={project.lang}>
			{draft ? <DraftNotice /> : null}
			<CaseStudyHero project={project} />

			<div className="hm-container hm-grid gap-y-16 py-[clamp(4rem,9vw,8rem)]">
				<div className="col-span-4 flex flex-col gap-10 md:col-span-4 lg:col-span-4">
					<FactSheet project={project} />
					{/* apps:start */}
					{isAppSlug(project.appSlug) ? (
						<ButtonLink to={appPath(project.appSlug)} className="self-start">
							{m.portfolio_case_try_app()}
						</ButtonLink>
					) : null}
					{/* apps:end */}
					{/* taskline:start */}
					{project.appSlug === "taskline" ? <TasklineLink /> : null}
					{/* taskline:end */}
					{/* kharcha:start */}
					{project.appSlug === "kharcha" ? <KharchaLink /> : null}
					{/* kharcha:end */}
				</div>
				<div className="col-span-4 flex flex-col gap-[clamp(3.5rem,7vw,6rem)] md:col-span-8 lg:col-span-7 lg:col-start-6">
					{project.metrics.length > 0 ? (
						<section aria-labelledby="outcomes-title" className="flex flex-col gap-8">
							<h2 id="outcomes-title" className="hm-display text-hm-lead">
								{m.portfolio_case_outcomes()}
							</h2>
							<FigureLines metrics={project.metrics} size="small" />
						</section>
					) : null}
					<CaseStudyBody blocks={project.body} gallery={project.gallery} cover={project.cover} />
				</div>
			</div>

			<NextProject next={next} />
		</article>
	);
}
