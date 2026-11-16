import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SectionPending } from "@/components/errors/pending-page";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { profileQueryOptions } from "../../queries";
import { PortfolioFooter } from "./portfolio-footer";
import { PortfolioHeader } from "./portfolio-header";
import { PortfolioPending } from "./portfolio-pending";

/**
 * The section's frame: the token scope, the header, the main landmark (the root skip link's
 * target) and the footer. The layout route's component and its not-found component both
 * render it, so it lives here: a binding that two split parts of a route file share goes
 * into every page's JavaScript since router-plugin 1.169 (0299).
 */
export function PortfolioShell({ children }: { children: ReactNode }) {
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
