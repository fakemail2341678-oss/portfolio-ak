import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { CrudListPage, CrudListPending } from "@/components/crud/crud-list-page";
import { useCrudMutation, withoutRows } from "@/components/crud/use-crud-mutation";
import type { DataTableColumn } from "@/components/data-table";
import { SearchFilter, SelectFilter } from "@/components/filters/filters";
import { useListPage } from "@/hooks/use-list-page";
import { choiceChip, defineFilters, textChip } from "@/lib/crud/filters";
import { formatDateTime } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { chaalKeys } from "../../keys";
import { BlockButton, BlockDialogSlot, type BlockOpen, ConnectionTabs } from "../connections/connection-list";
import { BLOCK_KIND_FILTER_LABELS, BLOCK_KIND_LABELS } from "../labels";
import { chaalAdminMutations, chaalBlocksQueryOptions } from "../queries";
import type { ChaalAdminBlock } from "../schema";
import { BLOCK_KIND_FILTERS, type BlockKindFilter, CHAAL_BLOCKS_TABLE_ID, type ChaalBlockSearch } from "../search";

const route = getRouteApi("/_admin/admin/chaal/blocks/");

const label = (row: ChaalAdminBlock) => row.email ?? row.target;

const columns: ReadonlyArray<DataTableColumn<ChaalAdminBlock>> = [
	{
		id: "target",
		header: m.ch_admin_col_blocked,
		cellClassName: "max-w-64",
		cell: (row) => (
			<div className="flex min-w-0 flex-col">
				<span className="truncate font-medium">{row.target}</span>
				<span className="truncate text-muted-foreground text-xs">
					{row.kind === "user" ? (row.email ?? m.ch_admin_guest()) : BLOCK_KIND_LABELS.lichess()}
				</span>
			</div>
		),
		csv: (row) => label(row),
	},
	{
		id: "kind",
		header: m.ch_admin_col_kind,
		hideable: true,
		cell: (row) => BLOCK_KIND_LABELS[row.kind](),
		csv: (row) => BLOCK_KIND_LABELS[row.kind](),
	},
	{
		id: "reason",
		header: m.ch_admin_col_reason,
		cellClassName: "max-w-96 whitespace-normal",
		cell: (row) => row.reason,
		csv: (row) => row.reason,
	},
	{
		id: "by",
		header: m.ch_admin_col_by,
		hideable: true,
		cell: (row) => row.blockedBy ?? <span className="text-muted-foreground">{m.ch_admin_nobody()}</span>,
		csv: (row) => row.blockedBy ?? "",
	},
	{
		id: "created",
		header: m.ch_admin_col_blocked_at,
		sort: "created",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.createdAt),
		csv: (row) => row.createdAt,
	},
];

const filters = defineFilters<ChaalBlockSearch>([
	textChip("q", m.crud_search),
	choiceChip("kind", m.ch_admin_col_kind, (kind: BlockKindFilter) => BLOCK_KIND_FILTER_LABELS[kind]()),
]);

export function ChaalBlocksPending() {
	return (
		<CrudListPending
			title={m.ch_admin_blocks_title()}
			description={m.ch_admin_blocks_description()}
			actions={<BlockButton onOpen={() => {}} />}
			columns={columns.length}
		/>
	);
}

/**
 * /admin/chaal/blocks (PLAN Task 79, decision 0268): the Lichess accounts and site users
 * Chaal refuses. "Unblock" lets them connect again.
 */
export function ChaalBlocksPage() {
	const search = route.useSearch();
	const list = useListPage({ tableId: CHAAL_BLOCKS_TABLE_ID, search, query: chaalBlocksQueryOptions });
	const [blocking, setBlocking] = useState<BlockOpen>(null);
	const unblock = useCrudMutation(chaalAdminMutations.unblock(), {
		invalidate: [chaalKeys.adminBlocks(), chaalKeys.adminConnections()],
		optimistic: { queryKey: chaalKeys.adminBlocks(), update: withoutRows<ChaalAdminBlock> },
	});

	return (
		<CrudListPage
			title={m.ch_admin_blocks_title()}
			description={m.ch_admin_blocks_description()}
			actions={<BlockButton onOpen={() => setBlocking({})} />}
			tabs={<ConnectionTabs />}
			tableId={CHAAL_BLOCKS_TABLE_ID}
			list={list}
			columns={columns}
			getRowLabel={label}
			search={search}
			filters={{
				controls: (
					<>
						<SearchFilter label={m.crud_search()} value={search.q} placeholder={m.ch_admin_blocks_search()} />
						<SelectFilter
							name="kind"
							label={m.ch_admin_col_kind()}
							value={search.kind}
							options={BLOCK_KIND_FILTERS.map((kind) => ({ value: kind, label: BLOCK_KIND_FILTER_LABELS[kind]() }))}
						/>
					</>
				),
				...filters.applied(search),
			}}
			remove={{
				permission: "chaal:moderate",
				run: (ids) => unblock.mutateAsync(ids),
				description: m.ch_admin_unblock_body,
			}}
			empty={{
				description: m.ch_admin_blocks_empty(),
				filtered: m.ch_admin_empty_filtered(),
				action: <BlockButton onOpen={() => setBlocking({})} />,
			}}
			exportName="chaal-blocks"
			data-testid="chaal-blocks-table"
		>
			<BlockDialogSlot open={blocking} onClose={() => setBlocking(null)} />
		</CrudListPage>
	);
}
