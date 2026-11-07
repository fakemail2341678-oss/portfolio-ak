import { createFileRoute } from "@tanstack/react-router";
import { __Pascal__List } from "@/features/__name__/components/__name__-list";
import { __Pascal__Pending } from "@/features/__name__/components/__name__-pending";
import { __camel__ListQueryOptions } from "@/features/__name__/queries";
import { __UPPER___TABLE_ID, __camel__List } from "@/features/__name__/search";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/__name__/")({
	...listSearch(__camel__List.search, __camel__List.defaults),
	loaderDeps: ({ search }) => search,
	loader: (route) => listLoader(route, { tableId: __UPPER___TABLE_ID, query: __camel__ListQueryOptions }),
	head: titleHead(m.__snake___title),
	pendingComponent: __Pascal__Pending,
	component: __Pascal__List,
});
