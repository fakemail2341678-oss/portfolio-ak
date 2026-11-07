import { createFileRoute } from "@tanstack/react-router";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { ContactPage } from "@/features/portfolio/components/pages/contact-page";
import { himalOgImage } from "@/features/portfolio/lib/og-image";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_site/contact")({
	// The form needs Turnstile's site key (when configured).
	loader: async ({ context: { queryClient } }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { profileQueryOptions } = await import("@/features/portfolio/queries");
		await Promise.all([
			ensureQuery(queryClient, profileQueryOptions()),
			ensureQuery(queryClient, authFeaturesQueryOptions()),
		]);
	},
	staticData: { breadcrumb: staticCrumb(m.portfolio_nav_contact) },
	head: () =>
		seo({
			title: m.portfolio_contact_title(),
			image: himalOgImage(m.portfolio_contact_title()),
			description: m.portfolio_contact_description(),
			path: "/contact",
		}),
	component: ContactPage,
});
