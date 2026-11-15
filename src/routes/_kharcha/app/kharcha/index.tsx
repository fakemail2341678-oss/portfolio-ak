import { createFileRoute, redirect } from "@tanstack/react-router";
import { KharchaLanding } from "@/features/kharcha/landing/components/kharcha-landing-page";
import { KHARCHA_NAME } from "@/features/kharcha/lib/brand";
import { kharchaLinks } from "@/features/kharcha/links";
import { absoluteUrl, seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * /app/kharcha: the product page for visitors, Kharcha's one indexable page.
 * Anyone signed in (a guest too) goes straight to Home.
 */
export const Route = createFileRoute("/_kharcha/app/kharcha/")({
	beforeLoad: ({ context }) => {
		if (context.session) throw redirect(kharchaLinks.home());
	},
	head: () =>
		seo({
			title: m.kharcha_landing_title(),
			siteName: KHARCHA_NAME,
			description: m.kharcha_landing_description(),
			path: "/app/kharcha",
			jsonLd: {
				"@type": "SoftwareApplication",
				name: KHARCHA_NAME,
				applicationCategory: "FinanceApplication",
				operatingSystem: "Web",
				description: m.kharcha_landing_description(),
				url: absoluteUrl("/app/kharcha"),
				offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
			},
		}),
	component: KharchaLanding,
});
