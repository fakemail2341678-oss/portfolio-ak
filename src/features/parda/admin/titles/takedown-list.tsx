import { getRouteApi } from "@tanstack/react-router";
import { CrudListPage, CrudListPending } from "@/components/crud/crud-list-page";
import { NewButton } from "@/components/crud/new-button";
import { useCrudMutation, withoutRows } from "@/components/crud/use-crud-mutation";
import type { DataTableColumn } from "@/components/data-table";
import { SearchFilter, SelectFilter } from "@/components/filters/filters";
import { useListPage } from "@/hooks/use-list-page";
import { choiceChip, defineFilters, textChip } from "@/lib/crud/filters";
import { formatDateTime } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { pardaAdminKeys } from "../keys";
import { MEDIA_LABELS } from "../labels";
import { pardaAdminMutations, pardaTakedownsQueryOptions } from "../queries";
import type { AdminTakedown } from "../schema";
import {
	PARDA_MEDIA_FILTERS,
	PARDA_TAKEDOWNS_TABLE_ID,
	type PardaMediaFilter,
	type PardaTakedownSearch,
} from "../search";
import { TitleCell, titleText } from "../title-cell";

const route = getRouteApi("/_admin/admin/parda/titles/");

const mediaFilterLabel = (media: PardaMediaFilter) =>
	media === "all" ? m.pd_admin_filter_all() : MEDIA_LABELS[media]();

const columns: ReadonlyArray<DataTableColumn<AdminTakedown>> = [
	{
		id: "title",
		header: m.pd_admin_col_title,
		cellClassName: "max-w-72",
		cell: (row) => <TitleCell row={row} />,
		csv: (row) => titleText(row),
	},
	{
		id: "reason",
		header: m.pd_admin_col_reason,
		cellClassName: "max-w-96 whitespace-normal",
		cell: (row) => row.reason,
		csv: (row) => row.reason,
	},
	{
		id: "by",
		header: m.pd_admin_col_blocked_by,
		hideable: true,
		cell: (row) => row.blockedBy ?? <span className="text-muted-foreground">{m.pd_admin_nobody()}</span>,
		csv: (row) => row.blockedBy ?? "",
	},
	{
		id: "created",
		header: m.pd_admin_col_blocked_at,
		sort: "created",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.createdAt),
		csv: (row) => row.createdAt,
	},
];

const filters = defineFilters<PardaTakedownSearch>([
	textChip("q", m.crud_search),
	choiceChip("media", m.pd_admin_filter_media, mediaFilterLabel),
]);

function BlockTitleButton() {
	return (
		<NewButton to="/admin/parda/titles/new" permission="parda:moderate">
			{m.pd_admin_takedown_new()}
		</NewButton>
	);
}

export function PardaTakedownsPending() {
	return (
		<CrudListPending
			title={m.pd_admin_takedowns_title()}
			description={m.pd_admin_takedowns_description()}
			actions={<BlockTitleButton />}
			columns={columns.length}
		/>
	);
}

/**
 * /admin/parda/titles (PLAN Task 65, decision 0237): the takedowns. A blocked title is
 * Parda's 404 and leaves every list, from every entry point; "Unblock" brings it back.
 */
export function PardaTakedownsPage() {
	const search = route.useSearch();
	const list = useListPage({ tableId: PARDA_TAKEDOWNS_TABLE_ID, search, query: pardaTakedownsQueryOptions });
	const unblock = useCrudMutation(pardaAdminMutations.unblockTitles(), {
		invalidate: [pardaAdminKeys.takedowns()],
		optimistic: { queryKey: pardaAdminKeys.takedowns(), update: withoutRows<AdminTakedown> },
	});

	return (
		<CrudListPage
			title={m.pd_admin_takedowns_title()}
			description={m.pd_admin_takedowns_description()}
			actions={<BlockTitleButton />}
			tableId={PARDA_TAKEDOWNS_TABLE_ID}
			list={list}
			columns={columns}
			getRowLabel={titleText}
			search={search}
			filters={{
				controls: (
					<>
						<SearchFilter label={m.crud_search()} value={search.q} placeholder={m.pd_admin_takedowns_search()} />
						<SelectFilter
							name="media"
							label={m.pd_admin_filter_media()}
							value={search.media}
							options={PARDA_MEDIA_FILTERS.map((media) => ({ value: media, label: mediaFilterLabel(media) }))}
						/>
					</>
				),
				...filters.applied(search),
			}}
			remove={{
				permission: "parda:moderate",
				run: (ids) => unblock.mutateAsync(ids),
				description: m.pd_admin_takedown_unblock_body,
			}}
			empty={{
				description: m.pd_admin_takedowns_empty(),
				filtered: m.pd_admin_empty_filtered(),
				action: <BlockTitleButton />,
			}}
			exportName="parda-takedowns"
			data-testid="parda-takedowns-table"
		/>
	);
}
