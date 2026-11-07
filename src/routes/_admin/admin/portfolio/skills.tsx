import { createFileRoute } from "@tanstack/react-router";
import { SkillsPage } from "@/features/portfolio/admin/components/section-pages";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/portfolio/skills")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "portfolio:read"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { skillSection } = await import("@/features/portfolio/admin/queries");
		return ensureQuery(context.queryClient, skillSection.list());
	},
	staticData: { breadcrumb: staticCrumb(m.portfolio_admin_skills_title) },
	head: titleHead(m.portfolio_admin_skills_title),
	component: SkillsPage,
});
