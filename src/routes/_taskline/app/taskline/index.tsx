import { createFileRoute, redirect } from "@tanstack/react-router";
import { TASKLINE_NAME } from "@/features/taskline/brand";
import { TasklineLanding } from "@/features/taskline/landing/taskline-landing";
import { tasklineLinks } from "@/features/taskline/links";
import { absoluteUrl, seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * /app/taskline: the product page for visitors, Taskline's one indexable page.
 * Anyone signed in (a guest too) goes straight to Home.
 */
export const Route = createFileRoute("/_taskline/app/taskline/")({
	beforeLoad: ({ context }) => {
		if (context.session) throw redirect(tasklineLinks.home());
	},
	head: () =>
		seo({
			title: m.taskline_landing_title(),
			siteName: TASKLINE_NAME,
			description: m.taskline_landing_description(),
			path: "/app/taskline",
			jsonLd: {
				"@type": "SoftwareApplication",
				name: TASKLINE_NAME,
				applicationCategory: "BusinessApplication",
				operatingSystem: "Web",
				description: m.taskline_landing_description(),
				url: absoluteUrl("/app/taskline"),
				offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
			},
		}),
	component: TasklineLanding,
});
