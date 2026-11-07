import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SectionPending } from "@/components/errors/pending-page";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { PortfolioFooter } from "@/features/portfolio/components/chrome/portfolio-footer";
import { PortfolioHeader } from "@/features/portfolio/components/chrome/portfolio-header";
import { PortfolioNotFound } from "@/features/portfolio/components/chrome/portfolio-not-found";
import { PortfolioPending } from "@/features/portfolio/components/chrome/portfolio-pending";
import { portfolioFontPreloads } from "@/features/portfolio/lib/fonts";
import { profileQueryOptions } from "@/features/portfolio/queries";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { NOINDEX } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/**
 * The portfolio at `/` (docs/guides/portfolio.md): a pathless layout with its own
 * header and footer, its design tokens scoped under `.himal`
 * (src/styles/himal.css). Its content comes from the database through
 * public server functions (decision 0176). Its pages never read the session,
 * so the root skips looking it up (`staticData.session: "skip"`, decision 0161).
 */
export const Route = createFileRoute("/_site")({
	// The header and footer need the owner's name, email and links on every page.
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { profileQueryOptions } = await import("@/features/portfolio/queries");
		return ensureQuery(context.queryClient, profileQueryOptions());
	},
	staticData: { session: "skip", breadcrumb: staticCrumb(m.portfolio_section_label) },
	// noindex is only the fallback (a 404 inside the section): every page's own seo() overrides it.
	head: () => ({ meta: [NOINDEX], links: portfolioFontPreloads(getLocale()) }),
	// A layout's notFoundComponent replaces the layout, so it brings the shell itself.
	notFoundComponent: () => (
		<PortfolioShell>
			<PortfolioNotFound />
		</PortfolioShell>
	),
	component: () => (
		<PortfolioShell>
			<Outlet />
		</PortfolioShell>
	),
});

/** The section's frame: the token scope, the header, the main landmark (the root skip link's target) and the footer. */
function PortfolioShell({ children }: { children: ReactNode }) {
	const { data: profile } = useSuspenseQuery(profileQueryOptions());
	return (
		<div id="hm-top" className="himal hm-canvas flex flex-1 flex-col">
			<NavigationProgress className="h-1 bg-hm-ink" />
			<PortfolioHeader profile={profile} />
			<main {...MAIN_CONTENT} className="flex-1 outline-none">
				<SectionPending component={PortfolioPending}>{children}</SectionPending>
			</main>
			<PortfolioFooter profile={profile} />
		</div>
	);
}
