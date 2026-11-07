import { createFileRoute } from "@tanstack/react-router";
import { JournalPage } from "@/features/portfolio/components/pages/journal-page";
import { himalOgImage } from "@/features/portfolio/lib/og-image";
import { blogJsonLd } from "@/features/portfolio/lib/structured-data";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_site/journal/")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { journalQueryOptions } = await import("@/features/portfolio/queries");
		return ensureQuery(context.queryClient, journalQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.portfolio_nav_journal) },
	head: () =>
		seo({
			title: m.portfolio_journal_title(),
			image: himalOgImage(m.portfolio_journal_title()),
			description: m.portfolio_journal_description(),
			path: "/journal",
			jsonLd: blogJsonLd({ name: m.portfolio_journal_title(), description: m.portfolio_journal_description() }),
		}),
	component: JournalPage,
});
