import { createFileRoute } from "@tanstack/react-router";
import { UsersList } from "@/features/rbac/components/users-list";
import { USERS_TABLE_ID, userList } from "@/features/rbac/search";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/users/")({
	...listSearch(userList.search, userList.defaults),
	loaderDeps: ({ search }) => search,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { roleOptionsQueryOptions, usersListQueryOptions } = await import("@/features/rbac/queries");
		return listLoader(route, {
			tableId: USERS_TABLE_ID,
			query: usersListQueryOptions,
			also: (queryClient) => ensureQuery(queryClient, roleOptionsQueryOptions()),
		});
	},
	head: titleHead(m.users_title),
	component: UsersList,
});
