import { createFileRoute } from "@tanstack/react-router";
import { PermissionsPage } from "@/features/rbac/components/permissions-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/roles/permissions")({
	// Awaited: the whole matrix is in the SSR HTML.
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { rolesQueryOptions } = await import("@/features/rbac/queries");
		return ensureQuery(context.queryClient, rolesQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.admin_nav_permissions) },
	head: titleHead(m.matrix_title),
	component: PermissionsPage,
});
