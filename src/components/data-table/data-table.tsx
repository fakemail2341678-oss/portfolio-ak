import {
	type ColumnDef,
	columnPinningFeature,
	columnVisibilityFeature,
	type RowData,
	type RowSelectionState,
	rowSelectionFeature,
	rowSortingFeature,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, Columns3Icon, DownloadIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SearchLink } from "@/components/navigation/search-link";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type CsvColumn, downloadCsv, toCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/i18n/intl";
import { useTablePreferences } from "@/lib/stores/hooks";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { type RowAction, RowActionItems, RowActionsMenu, usePermittedActions } from "./row-actions";
import { SavedViewsMenu, type SavedViewsStore } from "./saved-views";

/** One column of a DataTable. Define a feature's columns once, next to its schema. */
export type DataTableColumn<Row> = {
	/** Stable id: used for visibility preferences and React keys. */
	id: string;
	/** Localized header label (a Paraglide message). */
	header: () => string;
	/** Keep the header for screen readers only (image or icon columns). */
	srOnlyHeader?: boolean;
	cell: (row: Row) => ReactNode;
	/** Makes the header a sort link: the ascending value in `?sort=`; descending is `-value`. */
	sort?: string;
	/** Listed in the Columns menu and hideable by the user. */
	hideable?: boolean;
	/** A hideable column that starts hidden: the user shows it from the Columns menu (optional extras). */
	defaultHidden?: boolean;
	/** The cell as plain text for the CSV export; columns without it are left out of the file. */
	csv?: CsvColumn<Row>["value"];
	headClassName?: string;
	cellClassName?: string;
};

export type BulkSelection = { ids: string[]; clear: () => void };

export type DataTableProps<Row> = {
	/** Key for this table's saved preferences (hidden columns, page size) and saved views. */
	tableId: string;
	rows: ReadonlyArray<Row>;
	columns: ReadonlyArray<DataTableColumn<Row>>;
	getRowId: (row: Row) => string;
	/** Human name of a row, for "Select {label}" and "Actions for {label}". */
	getRowLabel: (row: Row) => string;
	/** The current `?sort=` value, when any column is sortable. */
	sort?: string;
	/** Adds a checkbox column; actions for the selection appear in a bar above the table. */
	bulkActions?: (selection: BulkSelection) => ReactNode;
	/** A row's actions, in its "…" menu and its right-click menu. Items with a `permission` show only to users who hold it. */
	rowActions?: (row: Row) => ReadonlyArray<RowAction>;
	/** Left of the toolbar: the FilterBar. The Columns menu, saved views and CSV export sit on the right. */
	toolbar?: ReactNode;
	/** Under the toolbar: the active filter chips. */
	activeFilters?: ReactNode;
	/** Adds "Export CSV" for the rows on screen (the columns with a `csv` value), saved as `{exportName}.csv`. */
	exportName?: string;
	/** Adds a "Views" menu: named searches for this table, kept in this browser (`true`) or in the store given. */
	savedViews?: boolean | SavedViewsStore;
	/** Shown instead of the table when there are no rows (the toolbar stays). */
	empty?: ReactNode;
	/** New rows are loading (a filter or page change); the current ones are dimmed meanwhile. */
	busy?: boolean;
	/**
	 * Makes the frame a tab stop (a labelled region), so keyboard users can scroll a table
	 * that is wider than the page and has no link or button to reach it by (a column per
	 * question, plain text cells). Long tables get this anyway.
	 */
	scrollRegion?: boolean;
	/** The region's name, when a page has more than one: landmarks need names of their own. */
	scrollRegionLabel?: string;
	/**
	 * Groups consecutive rows under a heading row (each group its own <tbody>): the
	 * server sorts by the group first, so a page's rows of one group are together.
	 */
	groupOf?: (row: Row) => { id: string; label: ReactNode };
	"data-testid"?: string;
};

const features = tableFeatures({
	columnVisibilityFeature,
	rowSelectionFeature,
	rowSortingFeature,
	columnPinningFeature,
});

const SORT_ICONS = { asc: ArrowUpIcon, desc: ArrowDownIcon, none: ArrowUpDownIcon } as const;
const ARIA_SORT = { asc: "ascending", desc: "descending", none: "none" } as const;
/** Past this many rows the table scrolls inside its frame, under a sticky header. */
const STICKY_AFTER_ROWS = 15;
const SELECT = "__select";
const ACTIONS = "__actions";

/**
 * A server-paginated table on TanStack Table (decision 0169): rows are the current
 * page (from a loader), sorting is a link that changes `?sort=` (and resets
 * `?page=`), so the URL stays the source of truth and the table renders fully on
 * the server, before and without JavaScript. TanStack Table runs in manual mode: it
 * holds column visibility (the preferences cookie), selection (this page's rows
 * only) and pinning (the first column stays put when a phone scrolls the table).
 */
export function DataTable<Row extends RowData>({
	tableId,
	rows,
	columns,
	getRowId,
	getRowLabel,
	sort,
	bulkActions,
	rowActions,
	toolbar,
	activeFilters,
	exportName,
	savedViews = false,
	empty,
	busy = false,
	scrollRegion = false,
	scrollRegionLabel,
	groupOf,
	"data-testid": testId,
}: DataTableProps<Row>) {
	const preferences = useTablePreferences(tableId);
	const permitted = usePermittedActions();
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const byId = new Map(columns.map((column) => [column.id, column]));
	const firstColumn = columns.find((column) => !column.hideable) ?? columns[0];
	// Each row's permitted actions; no column at all when no row has any (a reader sees none).
	const actionsById = new Map(
		rowActions ? rows.map((row) => [getRowId(row), permitted(rowActions(row))] as const) : [],
	);
	const hasActions = [...actionsById.values()].some((actions) => actions.length > 0);
	const sorted = columns.find((column) => column.sort && (sort === column.sort || sort === `-${column.sort}`));

	const definitions: ColumnDef<typeof features, Row>[] = [
		...(bulkActions ? [{ id: SELECT, enableHiding: false, header: () => null, cell: () => null }] : []),
		...columns.map(
			(column): ColumnDef<typeof features, Row> => ({
				id: column.id,
				enableHiding: Boolean(column.hideable),
				enableSorting: Boolean(column.sort),
				header: column.header,
				cell: ({ row }) => column.cell(row.original),
			}),
		),
		...(hasActions ? [{ id: ACTIONS, enableHiding: false, header: () => null, cell: () => null }] : []),
	];

	const columnVisibility = Object.fromEntries(
		columns.map((column) => [column.id, preferences.isColumnVisible(column.id, column.defaultHidden)]),
	);
	const table = useTable({
		features,
		columns: definitions,
		data: rows as Row[],
		getRowId: (row) => getRowId(row),
		manualSorting: true,
		enableRowSelection: Boolean(bulkActions),
		state: {
			columnVisibility,
			rowSelection,
			sorting: sorted?.sort ? [{ id: sorted.id, desc: sort?.startsWith("-") ?? false }] : [],
			columnPinning: { start: [...(bulkActions ? [SELECT] : []), ...(firstColumn ? [firstColumn.id] : [])], end: [] },
		},
		onRowSelectionChange: setRowSelection,
		onColumnVisibilityChange: (updater) => {
			const next = typeof updater === "function" ? updater(columnVisibility) : updater;
			for (const column of columns) {
				const visible = next[column.id] !== false;
				if (visible !== preferences.isColumnVisible(column.id, column.defaultHidden)) {
					preferences.setColumnVisible(column.id, visible, column.defaultHidden);
				}
			}
		},
	});

	// Only rows still on this page count (after a delete, a filter or a page change).
	const selectedIds = table.getSelectedRowModel().rows.map((row) => row.id);
	const clear = () => setRowSelection({});
	const allSelected = rows.length > 0 && selectedIds.length === rows.length;
	const hideable = table.getAllLeafColumns().filter((column) => column.getCanHide());
	const visibleColumns = columns.filter((column) => table.getColumn(column.id)?.getIsVisible() !== false);
	const csvColumns = visibleColumns.flatMap((column): CsvColumn<Row>[] =>
		column.csv ? [{ header: column.header(), value: column.csv }] : [],
	);
	const sticky = rows.length > STICKY_AFTER_ROWS;

	const tools = (
		<>
			{savedViews ? (
				<SavedViewsMenu tableId={tableId} store={typeof savedViews === "object" ? savedViews : undefined} />
			) : null}
			{exportName && csvColumns.length > 0 ? (
				<Button
					variant="outline"
					onClick={() => downloadCsv(`${exportName}.csv`, toCsv(rows, csvColumns))}
					data-testid="export-csv"
				>
					<DownloadIcon aria-hidden />
					{m.table_export_csv()}
				</Button>
			) : null}
			{hideable.length > 0 ? (
				// Non-modal: a small menu shouldn't aria-hide the page (it closes on Escape or outside click).
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button variant="outline">
							<Columns3Icon aria-hidden />
							{m.table_columns()}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>{m.table_columns()}</DropdownMenuLabel>
						{hideable.map((column) => (
							<DropdownMenuCheckboxItem
								key={column.id}
								checked={column.getIsVisible()}
								onCheckedChange={(checked) => column.toggleVisibility(checked === true)}
								onSelect={(event) => event.preventDefault()}
							>
								{byId.get(column.id)?.header()}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</>
	);
	const hasTools = Boolean(savedViews) || Boolean(exportName && csvColumns.length > 0) || hideable.length > 0;

	return (
		<div className="flex min-w-0 flex-col gap-3">
			{toolbar || hasTools ? (
				<div className="flex flex-wrap items-end justify-between gap-3">
					{toolbar}
					{hasTools ? (
						<ButtonGroup aria-label={m.table_tools()} className="ms-auto">
							{tools}
						</ButtonGroup>
					) : null}
				</div>
			) : null}
			{activeFilters}
			{rows.length === 0 && empty ? (
				<div aria-busy={busy || undefined}>{empty}</div>
			) : (
				<div
					className="flex flex-col gap-3 transition-opacity aria-busy:opacity-60 motion-reduce:transition-none"
					aria-busy={busy || undefined}
				>
					{bulkActions && selectedIds.length > 0 ? (
						<div
							className="flex flex-wrap items-center gap-3 rounded-md border bg-surface-1 px-3 py-2 text-body"
							data-testid="bulk-bar"
						>
							<span aria-live="polite">{m.table_selected({ count: formatNumber(selectedIds.length) })}</span>
							<Button variant="ghost" size="sm" onClick={clear}>
								{m.table_clear_selection()}
							</Button>
							<div className="ms-auto flex flex-wrap items-center gap-2">
								{bulkActions({ ids: selectedIds, clear })}
							</div>
						</div>
					) : null}
					{/* A focusable region when it scrolls on its own, so keyboard users can scroll it too.
					    `relative`: the cells' sr-only text is absolutely positioned and would widen the page otherwise. */}
					<div
						className={cn(
							"relative overflow-x-auto rounded-md border",
							(sticky || scrollRegion) &&
								"focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
							sticky && "max-h-[min(70dvh,48rem)] overflow-y-auto",
						)}
						{...(sticky || scrollRegion
							? { tabIndex: 0, role: "region", "aria-label": scrollRegionLabel ?? m.table_scroll_region() }
							: {})}
					>
						{/* A bare <table>: ui/table's own scroll wrapper would make the sticky header stick to it instead. */}
						<table data-slot="table" data-testid={testId} className="w-full caption-bottom text-body">
							<TableHeader
								className={cn(
									sticky && "sticky top-0 z-20 [&_th]:bg-background [&_th]:shadow-[inset_0_-1px_0_var(--border)]",
								)}
							>
								{table.getHeaderGroups().map((group) => (
									<TableRow key={group.id} className="hover:bg-transparent">
										{group.headers.map((header) => {
											const { id } = header.column;
											const pinned = header.column.getIsPinned() === "start";
											const pinClass = pinned ? pinnedClass(id === SELECT, Boolean(bulkActions)) : undefined;
											if (id === SELECT) {
												return (
													<TableHead key={header.id} className={cn("w-10", pinClass)}>
														<Checkbox
															aria-label={m.table_select_all()}
															checked={allSelected ? true : selectedIds.length > 0 ? "indeterminate" : false}
															onCheckedChange={(checked) =>
																setRowSelection(
																	checked === true ? Object.fromEntries(rows.map((row) => [getRowId(row), true])) : {},
																)
															}
														/>
													</TableHead>
												);
											}
											if (id === ACTIONS) {
												return (
													<TableHead key={header.id} className="w-12">
														<span className="sr-only">{m.table_actions()}</span>
													</TableHead>
												);
											}
											const column = byId.get(id);
											if (!column) return null;
											return (
												<HeaderCell
													key={header.id}
													column={column}
													state={header.column.getIsSorted() || "none"}
													className={pinClass}
												/>
											);
										})}
									</TableRow>
								))}
							</TableHeader>
							{groupRows(table.getRowModel().rows, groupOf).map((group) => (
								<TableBody key={group.id} data-testid={group.label === null ? undefined : "table-group"}>
									{group.label === null ? null : (
										<TableRow className="bg-surface-1 hover:bg-surface-1">
											<th
												scope="rowgroup"
												colSpan={table.getVisibleLeafColumns().length}
												className="px-3 py-2 text-start font-medium text-body"
											>
												{group.label}
											</th>
										</TableRow>
									)}
									{group.rows.map((row) => {
										const label = getRowLabel(row.original);
										const actions = actionsById.get(row.id) ?? [];
										const cells = row.getVisibleCells().map((cell) => {
											const { id } = cell.column;
											const pinned = cell.column.getIsPinned() === "start";
											const pinClass = pinned ? pinnedClass(id === SELECT, Boolean(bulkActions)) : undefined;
											if (id === SELECT) {
												return (
													<TableCell key={cell.id} className={pinClass}>
														<Checkbox
															aria-label={m.table_select_row({ label })}
															checked={row.getIsSelected()}
															onCheckedChange={(checked) => row.toggleSelected(checked === true)}
														/>
													</TableCell>
												);
											}
											if (id === ACTIONS) {
												return (
													<TableCell key={cell.id}>
														{actions.length > 0 ? <RowActionsMenu actions={actions} label={label} /> : null}
													</TableCell>
												);
											}
											const column = byId.get(id);
											return (
												<TableCell key={cell.id} className={cn(column?.cellClassName, pinClass)}>
													{column?.cell(row.original)}
												</TableCell>
											);
										});
										const tableRow = (
											<TableRow
												key={row.id}
												data-state={row.getIsSelected() ? "selected" : undefined}
												data-row-id={row.id}
												className="group/row"
											>
												{cells}
											</TableRow>
										);
										return actions.length > 0 ? (
											// Right-click a row for the same actions as its "…" menu (the menu is the keyboard way in).
											// Non-modal like the "…" menu: it shouldn't aria-hide the page.
											<ContextMenu key={row.id} modal={false}>
												<ContextMenuTrigger asChild>{tableRow}</ContextMenuTrigger>
												<ContextMenuContent>
													<RowActionItems actions={actions} kind="context" />
												</ContextMenuContent>
											</ContextMenu>
										) : (
											tableRow
										);
									})}
								</TableBody>
							))}
						</table>
					</div>
				</div>
			)}
		</div>
	);
}

/** Consecutive rows of one group together; one unnamed group without `groupOf`. */
function groupRows<T extends { original: unknown }>(
	rows: ReadonlyArray<T>,
	groupOf: ((row: never) => { id: string; label: ReactNode }) | undefined,
): Array<{ id: string; label: ReactNode | null; rows: T[] }> {
	if (!groupOf) return [{ id: "rows", label: null, rows: [...rows] }];
	const groups: Array<{ id: string; label: ReactNode | null; rows: T[] }> = [];
	for (const row of rows) {
		const group = (groupOf as (row: unknown) => { id: string; label: ReactNode })(row.original);
		const last = groups.at(-1);
		if (last && last.id === group.id) last.rows.push(row);
		else groups.push({ id: `${group.id}:${groups.length}`, label: group.label, rows: [row] });
	}
	return groups;
}

/**
 * Pinned columns stay at the inline start while a narrow table scrolls sideways
 * (phones only; wide screens show every column). They need a background of their
 * own, or the scrolled cells would show through.
 */
const pinnedClass = (isSelect: boolean, hasSelect: boolean) =>
	cn(
		"max-sm:sticky max-sm:z-10 max-sm:bg-background max-sm:group-data-[state=selected]/row:bg-muted",
		isSelect
			? "max-sm:start-0"
			: hasSelect
				? "max-sm:start-10 max-sm:shadow-[inset_-1px_0_0_var(--border)]"
				: "max-sm:start-0 max-sm:shadow-[inset_-1px_0_0_var(--border)]",
	);

function HeaderCell<Row>({
	column,
	state,
	className,
}: {
	column: DataTableColumn<Row>;
	state: "asc" | "desc" | "none";
	className?: string | undefined;
}) {
	const label = column.header();
	const headClassName = cn(column.headClassName, className);
	if (column.srOnlyHeader) {
		return (
			<TableHead className={headClassName}>
				<span className="sr-only">{label}</span>
			</TableHead>
		);
	}
	if (!column.sort) return <TableHead className={headClassName}>{label}</TableHead>;
	const Icon = SORT_ICONS[state];
	// Ascending first, then descending.
	const next = state === "asc" ? `-${column.sort}` : column.sort;
	return (
		<TableHead aria-sort={ARIA_SORT[state]} className={headClassName}>
			<SearchLink
				patch={{ sort: next, page: 1 }}
				className="inline-flex items-center gap-1 rounded-sm font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				{label}
				<Icon className="size-3.5 opacity-60" aria-hidden />
			</SearchLink>
		</TableHead>
	);
}
