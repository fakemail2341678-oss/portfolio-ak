import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { toast } from "sonner";
import { CrudListPage, CrudListPending } from "@/components/crud/crud-list-page";
import { useCrudCollection } from "@/components/crud/use-crud-collection";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusOf } from "@/components/data-display/status-badge";
import type { DataTableColumn, RowAction } from "@/components/data-table";
import { SearchFilter, SelectFilter } from "@/components/filters/filters";
import { Button } from "@/components/ui/button";
import { useListPage } from "@/hooks/use-list-page";
import { updateRows } from "@/lib/crud/collection";
import { choiceChip, defineFilters, textChip } from "@/lib/crud/filters";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import type { PardaReportStatus } from "../../../player/lib/playback";
import { pardaReportRows } from "../../collection";
import { TitleCell, titleText } from "../../components/title-cell";
import { pardaAdminKeys } from "../../keys";
import {
	REPORT_KIND_FILTER_LABELS,
	REPORT_KIND_LABELS,
	REPORT_STATUS,
	REPORT_STATUS_FILTER_LABELS,
} from "../../labels";
import { pardaAdminMutations, pardaReportsQueryOptions, pardaSourcesQueryOptions } from "../../queries";
import type { AdminReport } from "../../schema";
import {
	PARDA_REPORT_KIND_FILTERS,
	PARDA_REPORT_STATUS_FILTERS,
	PARDA_REPORTS_TABLE_ID,
	type PardaReportKindFilter,
	type PardaReportSearch,
	type PardaReportStatusFilter,
} from "../../search";

const route = getRouteApi("/_admin/admin/parda/reports");

const columns: ReadonlyArray<DataTableColumn<AdminReport>> = [
	{
		id: "kind",
		header: m.parda_admin_col_kind,
		cellClassName: "whitespace-nowrap font-medium",
		cell: (row) => REPORT_KIND_LABELS[row.kind](),
		csv: (row) => row.kind,
	},
	{
		id: "title",
		header: m.parda_admin_col_title,
		cellClassName: "max-w-64",
		cell: (row) => <TitleCell row={row} episode={row} />,
		csv: (row) => titleText(row),
	},
	{
		id: "source",
		header: m.parda_admin_col_source,
		hideable: true,
		cell: (row) =>
			row.source ? (
				localizedValue(row.source.name)
			) : (
				<span className="text-muted-foreground">{m.parda_admin_nobody()}</span>
			),
		csv: (row) => row.source?.name.en ?? "",
	},
	{
		id: "note",
		header: m.parda_admin_col_note,
		hideable: true,
		cellClassName: "max-w-80 whitespace-normal text-sm",
		cell: (row) => row.note || <span className="text-muted-foreground">{m.parda_admin_no_note()}</span>,
		csv: (row) => row.note,
	},
	{
		id: "status",
		header: m.parda_admin_col_status,
		cell: (row) => <StatusOf status={row.status} map={REPORT_STATUS} />,
		csv: (row) => row.status,
	},
	{
		id: "created",
		header: m.parda_admin_col_reported_at,
		sort: "created",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.createdAt),
		csv: (row) => row.createdAt,
	},
];

/** The source filter names the source; an id no source has any more reads as "deleted". */
const reportFilters = defineFilters<PardaReportSearch, { sourceName: (id: string) => string }>([
	textChip("q", m.crud_search),
	choiceChip(
		"status",
		m.parda_admin_filter_status,
		(status: PardaReportStatusFilter) => REPORT_STATUS_FILTER_LABELS[status](),
		"open",
	),
	choiceChip("kind", m.parda_admin_filter_kind, (kind: PardaReportKindFilter) => REPORT_KIND_FILTER_LABELS[kind]()),
	choiceChip("source", m.parda_admin_filter_source, (id: string, context) => context.sourceName(id)),
]);

export function PardaReportsPending() {
	return (
		<CrudListPending
			title={m.parda_admin_reports_title()}
			description={m.parda_admin_reports_description()}
			columns={columns.length}
		/>
	);
}

/**
 * /admin/parda/reports (PLAN Task 65, decision 0237): what viewers reported, open ones
 * first. Resolve, dismiss or reopen one, or resolve and dismiss the selected ones at once.
 */
export function PardaReportsPage() {
	const search = route.useSearch();
	const list = useListPage({ tableId: PARDA_REPORTS_TABLE_ID, search, query: pardaReportsQueryOptions });
	const { data: sources } = useSuspenseQuery(pardaSourcesQueryOptions());
	const sourceName = (id: string) => {
		const source = sources.find((each) => each.id === id);
		return source ? localizedValue(source.name) : m.parda_admin_source_deleted();
	};
	const collection = useCrudCollection(pardaReportRows);
	const setStatus = useCrudMutation(pardaAdminMutations.setReportStatus(), {
		invalidate: [pardaAdminKeys.reports(), pardaAdminKeys.sources()],
		optimistic: ({ ids, status }) =>
			updateRows(collection, ids, (row) => {
				row.status = status;
			}),
	});
	const change = (ids: string[], status: PardaReportStatus, done?: () => void) =>
		setStatus.mutate(
			{ ids, status },
			{
				onSuccess: ({ changed }) => {
					done?.();
					toast.success(m.parda_admin_reports_changed({ count: formatNumber(changed) }));
				},
			},
		);

	const rowActions = (row: AdminReport): RowAction[] => [
		{
			id: "resolve",
			label: m.parda_admin_report_resolve(),
			permission: "parda:moderate",
			hidden: row.status === "resolved",
			onSelect: () => change([row.id], "resolved"),
		},
		{
			id: "dismiss",
			label: m.parda_admin_report_dismiss(),
			permission: "parda:moderate",
			hidden: row.status === "dismissed",
			onSelect: () => change([row.id], "dismissed"),
		},
		{
			id: "reopen",
			label: m.parda_admin_report_reopen(),
			permission: "parda:moderate",
			hidden: row.status === "open",
			onSelect: () => change([row.id], "open"),
		},
	];

	return (
		<CrudListPage
			title={m.parda_admin_reports_title()}
			description={m.parda_admin_reports_description()}
			tableId={PARDA_REPORTS_TABLE_ID}
			list={list}
			collection={collection}
			columns={columns}
			getRowLabel={(row) => `${REPORT_KIND_LABELS[row.kind]()}: ${titleText(row)}`}
			search={search}
			filters={{
				controls: (
					<>
						<SearchFilter label={m.crud_search()} value={search.q} placeholder={m.parda_admin_reports_search()} />
						<SelectFilter
							name="status"
							label={m.parda_admin_filter_status()}
							value={search.status}
							options={PARDA_REPORT_STATUS_FILTERS.map((status) => ({
								value: status,
								label: REPORT_STATUS_FILTER_LABELS[status](),
							}))}
						/>
						<SelectFilter
							name="kind"
							label={m.parda_admin_filter_kind()}
							value={search.kind}
							options={PARDA_REPORT_KIND_FILTERS.map((kind) => ({
								value: kind,
								label: REPORT_KIND_FILTER_LABELS[kind](),
							}))}
						/>
						<SelectFilter
							name="source"
							label={m.parda_admin_filter_source()}
							value={search.source}
							options={[
								{ value: "all", label: m.parda_admin_filter_all() },
								...sources.map((source) => ({ value: source.id, label: localizedValue(source.name) })),
								...(search.source !== "all" && !sources.some((source) => source.id === search.source)
									? [{ value: search.source, label: m.parda_admin_source_deleted() }]
									: []),
							]}
						/>
					</>
				),
				...reportFilters.applied(search, { sourceName }),
			}}
			rowActions={rowActions}
			bulkActions={{
				permission: "parda:moderate",
				render: ({ ids, clear }) => (
					<>
						<Button size="sm" onClick={() => change(ids, "resolved", clear)} data-testid="parda-reports-resolve">
							{m.parda_admin_reports_resolve_selected()}
						</Button>
						<Button size="sm" variant="outline" onClick={() => change(ids, "dismissed", clear)}>
							{m.parda_admin_reports_dismiss_selected()}
						</Button>
					</>
				),
			}}
			empty={{ description: m.parda_admin_reports_empty(), filtered: m.parda_admin_empty_filtered() }}
			exportName="parda-reports"
			data-testid="parda-reports-table"
		/>
	);
}
