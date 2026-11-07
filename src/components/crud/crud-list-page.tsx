import type { ReactNode } from "react";
import { toast } from "sonner";
import {
	type BulkSelection,
	DataTable,
	type DataTableColumn,
	DataTableSkeleton,
	type RowAction,
} from "@/components/data-table";
import { useConfirm } from "@/components/dialogs/confirm";
import { ActiveFilters, ClearFiltersButton, type FilterChip } from "@/components/filters/active-filters";
import { FilterBar } from "@/components/filters/filter-bar";
import { Pagination, type PaginationProps } from "@/components/navigation/pagination";
import type { SearchPatch } from "@/components/navigation/search-link";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/rbac/can";
import type { Permission } from "@/features/rbac/permissions";
import { formatNumber } from "@/lib/i18n/intl";
import type { Paged } from "@/lib/list/paging";
import { m } from "@/paraglide/messages";

/** A paginated list (what useListPage returns), or a short list read whole (`rows`, e.g. roles). */
export type CrudList<Row> =
	| { page: Paged<Row> | undefined; busy: boolean; pagination: PaginationProps | null }
	| { rows: ReadonlyArray<Row> };

/** Deleting rows: a "Delete" row action, "Delete selected", the confirm and the toasts. */
export type CrudRemove<Row> = {
	permission: Permission;
	/** Deletes after the user confirmed; rejects when it failed (the mutation already said why). */
	run: (ids: string[]) => Promise<unknown>;
	/** Rows that can be deleted (system roles can't); default all. */
	can?: (row: Row) => boolean;
	/** Selection checkboxes and "Delete selected" (default true). */
	bulk?: boolean;
	/** What deleting means, in the confirm (default "This can't be undone."). */
	description?: () => string;
};

type Props<Row extends { id: string }> = {
	title: string;
	description?: string;
	/** Header buttons: "New …" (render them only for users who may use them). */
	actions?: ReactNode;
	tabs?: ReactNode;
	/** Between the header and the table: a control the whole list depends on (Parda's kill switch). */
	notice?: ReactNode;
	/** The table's preferences key (hidden columns, page size, saved views). */
	tableId: string;
	list: CrudList<Row>;
	columns: ReadonlyArray<DataTableColumn<Row>>;
	getRowLabel: (row: Row) => string;
	/** The list's search from the URL: the sort, and the filter form's values. */
	search?: Readonly<Record<string, unknown>> & { sort?: string };
	/** The filter controls (inside <FilterBar>) and the applied ones (defineFilters' `applied`). */
	filters?: { controls: ReactNode; chips: ReadonlyArray<FilterChip>; clearAll: SearchPatch };
	/** Each row's actions; Delete is added after them when `remove` is given. */
	rowActions?: (row: Row) => RowAction[];
	remove?: CrudRemove<Row>;
	/** More buttons for the selected rows, beside "Delete selected" (resolve reports). */
	bulkActions?: { permission: Permission; render: (selection: BulkSelection) => ReactNode };
	/** Nothing to show: `description` when nothing exists (with `action`), `filtered` when filters hide every row. */
	empty?: { description: string; filtered?: string; action?: ReactNode };
	/** Adds "Export CSV" (columns with `csv`). */
	exportName?: string;
	savedViews?: boolean;
	/** Dialogs over the list (a masked edit dialog). */
	children?: ReactNode;
	"data-testid"?: string;
};

/**
 * An admin list page, assembled once (docs/guides/crud.md): the header, the
 * filter bar and its chips, the DataTable with row and bulk actions, pagination,
 * the empty state (nothing yet, or nothing matching) and deleting with a
 * confirm. A feature supplies its columns, filters, actions and texts.
 */
export function CrudListPage<Row extends { id: string }>({
	title,
	description,
	actions,
	tabs,
	notice,
	tableId,
	list,
	columns,
	getRowLabel,
	search,
	filters,
	rowActions,
	remove,
	bulkActions,
	empty,
	exportName,
	savedViews,
	children,
	"data-testid": testId,
}: Props<Row>) {
	const confirm = useConfirm();
	const canDelete = useCan(...(remove ? [remove.permission] : []));
	const canBulk = useCan(...(bulkActions ? [bulkActions.permission] : []));
	const deletes = Boolean(remove && canDelete && remove.bulk !== false);
	const more = Boolean(bulkActions && canBulk);
	const rows = "rows" in list ? list.rows : list.page?.items;
	const pagination = "rows" in list ? null : list.pagination;

	const askDelete = async (selected: ReadonlyArray<Row>, done?: () => void) => {
		if (!remove || selected.length === 0) return;
		const count = formatNumber(selected.length);
		const label = selected.length === 1 && selected[0] ? getRowLabel(selected[0]) : undefined;
		const confirmed = await confirm({
			destructive: true,
			title: label ? m.crud_delete_title({ label }) : m.crud_bulk_delete_title({ count }),
			description: (remove.description ?? m.crud_delete_body)(),
			confirmLabel: m.crud_delete(),
		});
		if (!confirmed) return;
		done?.();
		try {
			await remove.run(selected.map((row) => row.id));
			toast.success(label ? m.crud_toast_deleted({ label }) : m.crud_toast_bulk_deleted({ count }));
		} catch {
			// useCrudMutation has shown what went wrong (and rolled the rows back).
		}
	};

	const actionsOf = (row: Row): RowAction[] => [
		...(rowActions?.(row) ?? []),
		...(remove && (remove.can?.(row) ?? true)
			? [
					{
						id: "delete",
						label: m.crud_delete(),
						permission: remove.permission,
						destructive: true,
						separated: true,
						onSelect: () => void askDelete([row]),
					} satisfies RowAction,
				]
			: []),
	];
	const filtered = (filters?.chips.length ?? 0) > 0;
	const busy = "rows" in list ? false : list.busy;

	return (
		<Page width="admin">
			<PageHeader title={title} description={description} actions={actions} tabs={tabs} />
			{notice}
			{rows ? (
				<>
					<DataTable
						tableId={tableId}
						rows={rows}
						columns={columns}
						getRowId={(row) => row.id}
						getRowLabel={getRowLabel}
						sort={search?.sort}
						busy={busy}
						data-testid={testId}
						toolbar={
							filters && search ? (
								<FilterBar values={search} preserve={["sort", "pageSize"]}>
									{filters.controls}
								</FilterBar>
							) : undefined
						}
						activeFilters={filters ? <ActiveFilters chips={filters.chips} clearAll={filters.clearAll} /> : undefined}
						exportName={exportName}
						savedViews={savedViews}
						bulkActions={
							deletes || more
								? (selection) => (
										<>
											{more ? bulkActions?.render(selection) : null}
											{deletes ? (
												<Button
													variant="destructive"
													size="sm"
													onClick={() =>
														void askDelete(
															rows.filter((row) => selection.ids.includes(row.id)),
															selection.clear,
														)
													}
												>
													{m.crud_delete_selected()}
												</Button>
											) : null}
										</>
									)
								: undefined
						}
						rowActions={rowActions || remove ? actionsOf : undefined}
						empty={
							empty ? (
								<EmptyState
									data-testid="empty"
									variant={filtered ? "no-matches" : "empty"}
									description={filtered ? (empty.filtered ?? empty.description) : empty.description}
									primaryAction={
										filtered && filters ? <ClearFiltersButton clearAll={filters.clearAll} /> : empty.action
									}
								/>
							) : undefined
						}
					/>
					{pagination ? <Pagination {...pagination} /> : null}
				</>
			) : (
				<DataTableSkeleton columns={columns.length} rows={8} />
			)}
			{children}
		</Page>
	);
}

/** A list route's pendingComponent: the same header and a table skeleton of the same width. */
export function CrudListPending({
	title,
	description,
	actions,
	columns,
}: {
	title: string;
	description?: string;
	actions?: ReactNode;
	/** How many columns the table has (its skeleton's width). */
	columns: number;
}) {
	return (
		<Page width="admin">
			<PageHeader title={title} description={description} actions={actions} />
			<DataTableSkeleton columns={columns} rows={8} />
		</Page>
	);
}
