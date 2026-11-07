import { getRouteApi, Link } from "@tanstack/react-router";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { useCrudMutation, withoutRows } from "@/components/crud/use-crud-mutation";
import type { RowAction } from "@/components/data-table";
import { useListPage } from "@/hooks/use-list-page";
{{#localized}}
import { localizedValue } from "@/lib/i18n/localized";
{{/localized}}
import { m } from "@/paraglide/messages";
import { __camel__Columns } from "../columns";
import { __Pascal__FilterControls, __camel__Filters } from "../filters";
import { __camel__Keys } from "../keys";
import { __camel__ListQueryOptions, __camel__Mutations } from "../queries";
import type { __Pascal__ListItem } from "../schema";
import { __UPPER___TABLE_ID } from "../search";
import { New__Pascal__Button } from "./__name__-pending";

const route = getRouteApi("/_admin/admin/__name__/");

/** /admin/__name__: search, the table with edit and delete (optimistic, undone if refused), pagination. */
export function __Pascal__List() {
	const search = route.useSearch();
	const list = useListPage({ tableId: __UPPER___TABLE_ID, search, query: __camel__ListQueryOptions });
	const remove = useCrudMutation(__camel__Mutations.delete(), {
		invalidate: [__camel__Keys.all],
		optimistic: { queryKey: __camel__Keys.lists(), update: withoutRows<__Pascal__ListItem> },
	});
	// Each action names its permission: users without it never see it (the server checks again).
	const rowActions = (row: __Pascal__ListItem): RowAction[] => [
		{
			id: "edit",
			label: m.crud_edit(),
			permission: "__name__:update",
			render: (label) => (
				<Link to="/admin/__name__/$id" params={{ id: row.id }}>
					{label}
				</Link>
			),
		},
	];

	return (
		<CrudListPage
			title={m.__snake___title()}
			description={m.__snake___description()}
			actions={<New__Pascal__Button />}
			tableId={__UPPER___TABLE_ID}
			list={list}
			columns={__camel__Columns}
			getRowLabel={(row) => {{#localized}}localizedValue(row.title){{/localized}}{{^localized}}row.title{{/localized}}}
			search={search}
			filters={{ controls: <__Pascal__FilterControls search={search} />, ...__camel__Filters.applied(search) }}
			rowActions={rowActions}
			remove={{ permission: "__name__:delete", run: (ids) => remove.mutateAsync(ids) }}
			empty={{
				description: m.__snake___empty(),
				filtered: m.__snake___empty_filtered(),
				action: <New__Pascal__Button />,
			}}
			exportName="__name__"
			data-testid="__name__-table"
		/>
	);
}
