import { createFileRoute } from "@tanstack/react-router";
import { ExperiencePage } from "@/features/portfolio/admin/components/section-page";
import { assertRoutePermission } from "@/features/rbac/lib/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/portfolio/experience")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "portfolio:read"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { experienceSection } = await import("@/features/portfolio/admin/lib/sections");
		return ensureQuery(context.queryClient, experienceSection.list());
	},
	staticData: { breadcrumb: staticCrumb(m.portfolio_admin_experience_title) },
	head: titleHead(m.portfolio_admin_experience_title),
	component: ExperiencePage,
});
