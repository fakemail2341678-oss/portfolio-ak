import { m } from "@/paraglide/messages";
import { ArchivalFigure } from "../primitives/archival-picture";
import { ButtonLink, TextLink } from "../primitives/links";

/** The portfolio's 404, off the map: a missing project or article, in the site's own voice and chrome. */
export function PortfolioNotFound() {
	return (
		<section aria-labelledby="not-found-title" className="hm-section" data-testid="portfolio-not-found">
			<div className="hm-container hm-grid items-center gap-y-12">
				<div className="col-span-4 flex flex-col gap-6 md:col-span-6">
					<h1 id="not-found-title" className="hm-display text-hm-title">
						{m.portfolio_not_found_title()}
					</h1>
					<p className="hm-measure text-hm-lead">{m.portfolio_not_found_body()}</p>
					<p className="flex flex-wrap items-center gap-x-7 gap-y-4 pt-2">
						<ButtonLink to="/">{m.portfolio_not_found_cta()}</ButtonLink>
						<TextLink to="/work">{m.portfolio_nav_work()}</TextLink>
					</p>
				</div>
				<ArchivalFigure
					picture="valleyMap"
					aspect="1 / 1"
					position="100% 50%"
					sizes="(min-width: 48rem) 40vw, 100vw"
					className="col-span-4 md:col-span-5 md:col-start-8"
				/>
			</div>
		</section>
	);
}
