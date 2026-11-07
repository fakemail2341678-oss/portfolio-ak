import { createFileRoute } from "@tanstack/react-router";
import { TestCrudList } from "@/features/test-crud/components/test-crud-list";
import { TestCrudPending } from "@/features/test-crud/components/test-crud-pending";
import { TEST_CRUD_TABLE_ID } from "@/features/test-crud/constants";
import { testCrudAdminRouteSearchSchema, testCrudList } from "@/features/test-crud/search";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/test-crud/")({
	...listSearch(testCrudAdminRouteSearchSchema, testCrudList.defaults),
	// `edit` only opens a dialog: changing it must not reload the list.
	loaderDeps: ({ search: { edit: _edit, ...list } }) => list,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { testCrudListQueryOptions, testCrudTagsQueryOptions } = await import("@/features/test-crud/queries");
		return listLoader(route, {
			tableId: TEST_CRUD_TABLE_ID,
			query: testCrudListQueryOptions,
			also: (queryClient) => ensureQuery(queryClient, testCrudTagsQueryOptions()),
		});
	},
	head: titleHead(m.test_crud_title),
	pendingComponent: TestCrudPending,
	component: TestCrudList,
});
