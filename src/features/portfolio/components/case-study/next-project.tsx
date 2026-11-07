import { Link } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";
import type { ProjectDetail } from "../../types";
import { MountainFrame } from "../art/mountain-frame";
import { ProjectMountain } from "../art/project-mountain";

/** The exit of a case study, on the ridge field: the next project as one large link, its mountain ready to morph. */
export function NextProject({ next }: { next: ProjectDetail["next"] }) {
	return (
		<nav aria-label={m.portfolio_case_next()} className="hm-field-ridge">
			<Link
				to="/work/$slug"
				params={{ slug: next.slug }}
				viewTransition
				className="hm-focus group block py-[clamp(4rem,9vw,8rem)]"
			>
				<div className="hm-container hm-grid items-end gap-y-10">
					<div className="col-span-4 flex flex-col gap-4 md:col-span-7">
						<p className="text-hm-lead text-hm-muted">{m.portfolio_case_next()}</p>
						<p className="hm-display text-hm-title decoration-[0.05em] decoration-hm-accent underline-offset-[0.1em] group-hover:underline">
							{next.title}
						</p>
						<p className="text-hm-lead">{next.client}</p>
					</div>
					<MountainFrame
						transitionSlug={next.slug}
						aspect="landscape"
						zoom
						className="col-span-4 md:col-span-5 md:col-start-8"
					>
						<ProjectMountain cover={next.cover} sizes="(min-width: 48rem) 40vw, 100vw" />
					</MountainFrame>
				</div>
			</Link>
		</nav>
	);
}
