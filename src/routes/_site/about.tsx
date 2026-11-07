import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/features/portfolio/components/pages/about-page";
import { himalOgImage } from "@/features/portfolio/lib/og-image";
import { profilePageJsonLd } from "@/features/portfolio/lib/structured-data";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_site/about")({
	loader: async ({ context: { queryClient } }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { aboutQueryOptions, profileQueryOptions } = await import("@/features/portfolio/queries");
		const [profile] = await Promise.all([
			ensureQuery(queryClient, profileQueryOptions()),
			ensureQuery(queryClient, aboutQueryOptions()),
		]);
		return {
			name: profile.name,
			role: profile.role,
			intro: profile.intro,
			socials: profile.socials.map((social) => social.href),
		};
	},
	staticData: { breadcrumb: staticCrumb(m.portfolio_nav_about) },
	head: ({ loaderData }) =>
		seo({
			title: m.portfolio_about_title(),
			image: himalOgImage(m.portfolio_about_title()),
			description: m.portfolio_about_description(),
			path: "/about",
			jsonLd: loaderData
				? profilePageJsonLd({
						name: loaderData.name,
						role: loaderData.role,
						description: loaderData.intro,
						socials: loaderData.socials,
					})
				: [],
		}),
	component: AboutPage,
});
