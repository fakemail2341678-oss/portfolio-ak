import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CrudListPage, CrudListPending } from "@/components/crud/crud-list-page";
import { NewButton } from "@/components/crud/new-button";
import { RecordLink } from "@/components/crud/record-link";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusBadge } from "@/components/data-display/status-badge";
import type { DataTableColumn, RowAction } from "@/components/data-table";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { pardaLinks } from "../../links";
import { pardaAdminKeys } from "../keys";
import { pardaAdminMutations, pardaCollectionsQueryOptions } from "../queries";
import type { AdminCollection } from "../schema";

const COLLECTIONS_TABLE_ID = "parda-collections";

const name = (row: AdminCollection) => localizedValue(row.name);

const columns: ReadonlyArray<DataTableColumn<AdminCollection>> = [
	{
		id: "name",
		header: m.pd_admin_col_name,
		cellClassName: "max-w-80",
		cell: (row) => (
			<RecordLink
				link={{ to: "/admin/parda/collections/$id", params: { id: row.id } }}
				permission="parda:curate"
				detail={`/c/${row.slug}`}
			>
				{name(row)}
			</RecordLink>
		),
		csv: (row) => row.name.en,
	},
	{
		id: "state",
		header: m.pd_admin_col_state,
		cell: (row) => (
			<StatusBadge tone={row.published ? "success" : "neutral"}>
				{row.published ? m.pd_admin_collection_published() : m.pd_admin_collection_draft()}
			</StatusBadge>
		),
		csv: (row) => (row.published ? "published" : "draft"),
	},
	{
		id: "count",
		header: m.pd_admin_col_titles,
		cellClassName: "tabular-nums",
		cell: (row) => formatNumber(row.count),
		csv: (row) => row.count,
	},
	{
		id: "updated",
		header: m.pd_admin_col_updated,
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.modifiedAt),
		csv: (row) => row.modifiedAt,
	},
];

function NewCollectionButton() {
	return (
		<NewButton to="/admin/parda/collections/new" permission="parda:curate">
			{m.pd_admin_collection_new()}
		</NewButton>
	);
}

export function PardaCollectionsPending() {
	return (
		<CrudListPending
			title={m.pd_admin_collections_title()}
			description={m.pd_admin_collections_description()}
			actions={<NewCollectionButton />}
			columns={columns.length}
		/>
	);
}

/**
 * /admin/parda/collections (PLAN Task 69, decision 0242): lists of titles the admin puts
 * together. A published one has its page at /app/parda/c/{slug}, and a rail once the
 * layout places it.
 */
export function PardaCollectionsPage() {
	const { data: rows } = useSuspenseQuery(pardaCollectionsQueryOptions());
	const remove = useCrudMutation(pardaAdminMutations.deleteCollections(), {
		invalidate: [pardaAdminKeys.all],
		optimistic: {
			queryKey: pardaAdminKeys.collections(),
			update: (list: AdminCollection[], ids: string[]) => list.filter((row) => !ids.includes(row.id)),
		},
	});
	const rowActions = (row: AdminCollection): RowAction[] => [
		{
			id: "edit",
			label: m.crud_edit(),
			permission: "parda:curate",
			render: (label) => (
				<Link to="/admin/parda/collections/$id" params={{ id: row.id }}>
					{label}
				</Link>
			),
		},
		...(row.published
			? [
					{
						id: "view",
						label: m.pd_admin_collection_view(),
						render: (label: ReactNode) => <Link {...pardaLinks.curated(row.slug)}>{label}</Link>,
					},
				]
			: []),
	];
	return (
		<CrudListPage
			title={m.pd_admin_collections_title()}
			description={m.pd_admin_collections_description()}
			actions={<NewCollectionButton />}
			tableId={COLLECTIONS_TABLE_ID}
			list={{ rows }}
			columns={columns}
			getRowLabel={name}
			rowActions={rowActions}
			remove={{
				permission: "parda:curate",
				run: (ids) => remove.mutateAsync(ids),
				description: m.pd_admin_collection_delete_body,
			}}
			empty={{ description: m.pd_admin_collections_empty(), action: <NewCollectionButton /> }}
			exportName="parda-collections"
			data-testid="parda-collections-table"
		/>
	);
}
