import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { seo } from "@/lib/seo";
import { websiteJsonLd } from "@/lib/structured-data";
import { m } from "@/paraglide/messages";

/**
 * The home page: a neutral landing page, written by `pnpm strip-demo` in place of
 * the portfolio. Make it yours (docs/guides/new-project.md); its head is the
 * site's: the site name as the title, and WebSite JSON-LD.
 */
export const Route = createFileRoute("/_public/")({
	head: () =>
		seo({
			description: m.landing_description(),
			path: "/",
			jsonLd: websiteJsonLd(m.landing_description()),
		}),
	component: Landing,
});

function Landing() {
	return (
		<Page width="narrow" className="gap-8">
			<PageHeader size="display" title={m.landing_title()} description={m.landing_intro()} />
			<div>
				<Button asChild>
					<Link to="/account">{m.landing_cta()}</Link>
				</Button>
			</div>
		</Page>
	);
}
