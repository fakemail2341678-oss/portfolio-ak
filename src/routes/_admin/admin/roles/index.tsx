import { createFileRoute } from "@tanstack/react-router";
import { RolesList } from "@/features/rbac/components/roles-list";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/roles/")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { rolesQueryOptions } = await import("@/features/rbac/queries");
		return ensureQuery(context.queryClient, rolesQueryOptions());
	},
	head: titleHead(m.roles_title),
	component: RolesList,
});
