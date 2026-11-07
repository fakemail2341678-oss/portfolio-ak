import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownUpIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { CrudListPage, CrudListPending } from "@/components/crud/crud-list-page";
import { NewButton } from "@/components/crud/new-button";
import { RecordLink } from "@/components/crud/record-link";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusBadge } from "@/components/data-display/status-badge";
import type { DataTableColumn, RowAction } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/rbac/can";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { pardaAdminKeys } from "../keys";
import { ADAPTER_LABELS, SANDBOX_LABELS } from "../labels";
import { pardaAdminMutations, pardaSourcesQueryOptions } from "../queries";
import type { AdminSource } from "../schema";
import { PlaybackSwitch } from "../settings/playback-switch";
import { SourceOrderSwitch } from "./source-order-switch";

// Opens on click: its dnd-kit list loads with it, not with the page (0168).
const ReorderSourcesDialog = lazy(() =>
	import("./source-reorder-dialog").then((module) => ({ default: module.ReorderSourcesDialog })),
);

const SOURCES_TABLE_ID = "parda-sources";

const name = (row: AdminSource) => localizedValue(row.name);

const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;
const dash = () => muted("—");

/** A measured value, or a dash when nothing measured it. */
const measured = <T,>(value: T | null | undefined, show: (value: T) => string) =>
	value === null || value === undefined ? dash() : show(value);

const percent = (value: number) => formatNumber(value, { style: "percent", maximumFractionDigits: 1 });
const decimal = (value: number, digits = 1) => formatNumber(value, { maximumFractionDigits: digits });
const qualityText = (height: number) =>
	m.pd_admin_quality_value({ height: formatNumber(height, { useGrouping: false }) });

const columns: ReadonlyArray<DataTableColumn<AdminSource>> = [
	{
		id: "position",
		header: m.pd_admin_col_position,
		headClassName: "w-12",
		cellClassName: "text-muted-foreground tabular-nums",
		cell: (row) => formatNumber(row.position + 1),
	},
	{
		id: "rank",
		header: m.pd_admin_col_rank,
		headClassName: "w-16",
		cellClassName: "tabular-nums",
		cell: (row) => (row.rank === null ? dash() : formatNumber(row.rank + 1)),
		csv: (row) => (row.rank === null ? "" : row.rank + 1),
	},
	{
		id: "name",
		header: m.pd_admin_col_name,
		cell: (row) => (
			<RecordLink
				link={{ to: "/admin/parda/sources/$id", params: { id: row.id } }}
				permission="parda:configure"
				detail={ADAPTER_LABELS[row.adapter]()}
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
			<div className="flex flex-wrap gap-1">
				<StatusBadge tone={row.enabled ? "success" : "neutral"}>
					{row.enabled ? m.pd_admin_source_enabled() : m.pd_admin_source_disabled()}
				</StatusBadge>
				{row.pinned ? <StatusBadge tone="info">{m.pd_admin_source_pinned()}</StatusBadge> : null}
			</div>
		),
		csv: (row) => (row.enabled ? "enabled" : "disabled"),
	},
	{
		id: "score",
		header: m.pd_admin_col_score,
		cellClassName: "whitespace-nowrap tabular-nums",
		cell: (row) =>
			row.standing?.score === null || row.standing?.score === undefined ? (
				muted(m.pd_admin_score_none())
			) : (
				<span className="flex flex-col">
					<span>{decimal(row.standing.score, 2)}</span>
					{row.standing.from === "probe" ? (
						<span className="text-muted-foreground text-xs">{m.pd_admin_score_from_probe()}</span>
					) : null}
				</span>
			),
		csv: (row) => row.standing?.score ?? "",
	},
	{
		id: "plays",
		header: m.pd_admin_col_plays,
		hideable: true,
		cellClassName: "tabular-nums",
		cell: (row) => formatNumber(row.standing?.plays ?? 0),
		csv: (row) => row.standing?.plays ?? 0,
	},
	{
		id: "failures",
		header: m.pd_admin_col_failures,
		hideable: true,
		cellClassName: "tabular-nums",
		cell: (row) => measured(row.standing?.failureRate, percent),
		csv: (row) => row.standing?.failureRate ?? "",
	},
	{
		id: "start",
		header: m.pd_admin_col_start,
		hideable: true,
		cellClassName: "whitespace-nowrap tabular-nums",
		cell: (row) =>
			measured(row.standing?.startMedianMs, (ms) => m.pd_admin_start_seconds({ seconds: decimal(ms / 1000) })),
		csv: (row) => row.standing?.startMedianMs ?? "",
	},
	{
		id: "stalls",
		header: m.pd_admin_col_stalls,
		hideable: true,
		cellClassName: "whitespace-nowrap tabular-nums",
		cell: (row) =>
			measured(row.standing?.stallPerMinute, (value) => m.pd_admin_stalls_per_minute({ seconds: decimal(value) })),
		csv: (row) => row.standing?.stallPerMinute ?? "",
	},
	{
		id: "quality",
		header: m.pd_admin_col_quality,
		hideable: true,
		cellClassName: "whitespace-nowrap",
		cell: (row) =>
			row.height === null ? (
				dash()
			) : (
				<span className="flex flex-col">
					<span className="tabular-nums">{qualityText(row.height)}</span>
					<span className="text-muted-foreground text-xs">
						{row.heightFrom === "admin" ? m.pd_admin_quality_from_admin() : m.pd_admin_quality_from_probe()}
					</span>
				</span>
			),
		csv: (row) => row.height ?? "",
	},
	{
		id: "popups",
		header: m.pd_admin_col_popups,
		hideable: true,
		cellClassName: "whitespace-nowrap tabular-nums",
		cell: (row) =>
			measured(row.standing?.popupsPerClick, (value) => m.pd_admin_popups_per_click({ count: decimal(value, 2) })),
		csv: (row) => row.standing?.popupsPerClick ?? "",
	},
	{
		id: "probe",
		header: m.pd_admin_col_probe,
		hideable: true,
		cellClassName: "whitespace-nowrap",
		cell: (row) => (row.standing?.probedAt ? formatDateTime(row.standing.probedAt) : muted(m.pd_admin_probe_never())),
		csv: (row) => row.standing?.probedAt ?? "",
	},
	{
		id: "group",
		header: m.pd_admin_col_group,
		hideable: true,
		defaultHidden: true,
		cell: (row) => row.cdnGroup || <span className="text-muted-foreground">{m.pd_admin_group_own()}</span>,
		csv: (row) => row.cdnGroup,
	},
	{
		id: "player",
		header: m.pd_admin_col_player,
		hideable: true,
		defaultHidden: true,
		cell: (row) => (
			<div className="flex max-w-64 flex-wrap gap-1">
				{row.adaptiveNow ? <Badge variant="outline">{m.pd_admin_source_adaptive()}</Badge> : null}
				{row.needsClick ? <Badge variant="outline">{m.pd_admin_source_needs_click()}</Badge> : null}
				{row.autoFallback ? null : <Badge variant="outline">{m.pd_admin_source_no_fallback()}</Badge>}
				{row.sandbox === "none" ? null : (
					<Badge variant="outline">{m.pd_admin_source_sandbox({ sandbox: SANDBOX_LABELS[row.sandbox]() })}</Badge>
				)}
			</div>
		),
	},
	{
		id: "reports",
		header: m.pd_admin_col_reports,
		hideable: true,
		cellClassName: "whitespace-nowrap tabular-nums",
		cell: (row) =>
			row.openReports === 0 ? (
				<span className="text-muted-foreground">{formatNumber(0)}</span>
			) : (
				<Link
					to="/admin/parda/reports"
					search={{ source: row.id }}
					className="underline-offset-4 hover:underline"
					aria-label={m.pd_admin_source_reports_link({
						count: formatNumber(row.openReports),
						ads: formatNumber(row.adsReports),
						name: name(row),
					})}
				>
					{m.pd_admin_source_reports({ count: formatNumber(row.openReports), ads: formatNumber(row.adsReports) })}
				</Link>
			),
		csv: (row) => row.openReports,
	},
];

/** "New source", for admins who may configure Parda. */
function NewSourceButton() {
	return (
		<NewButton to="/admin/parda/sources/new" permission="parda:configure">
			{m.pd_admin_source_new()}
		</NewButton>
	);
}

/** The list's pendingComponent: its header and a table skeleton. */
export function PardaSourcesPending() {
	return (
		<CrudListPending
			title={m.pd_admin_sources_title()}
			description={m.pd_admin_sources_description()}
			actions={<NewSourceButton />}
			columns={columns.length}
		/>
	);
}

/**
 * /admin/parda/sources (PLAN Tasks 65 and 65a, decisions 0237 and 0238): the rows the
 * watch page plays from, in the admin's order, each with its place in today's order and
 * its latest standing, under the kill switch and the order's mode. Enabling, pinning and
 * deleting show at once and roll back if the server refuses; "Reorder" sets the order.
 */
export function PardaSourcesPage() {
	const { data: rows } = useSuspenseQuery(pardaSourcesQueryOptions());
	const canConfigure = useCan("parda:configure");
	const [reordering, setReordering] = useState(false);
	const optimistic = { queryKey: pardaAdminKeys.sources() };

	const remove = useCrudMutation(pardaAdminMutations.deleteSources(), {
		invalidate: [pardaAdminKeys.all],
		optimistic: { ...optimistic, update: withoutRowsOf },
	});
	const setState = useCrudMutation(pardaAdminMutations.setSourceState(), {
		invalidate: [pardaAdminKeys.all],
		optimistic: {
			...optimistic,
			update: patchList((row, state: { id: string; enabled?: boolean; pinned?: boolean }) => ({ ...row, ...state })),
		},
	});
	const change = (row: AdminSource, state: { enabled?: boolean; pinned?: boolean }, done: () => string) =>
		setState.mutate({ id: row.id, ...state }, { onSuccess: () => toast.success(done()) });

	const rowActions = (row: AdminSource): RowAction[] => [
		{
			id: "edit",
			label: m.crud_edit(),
			permission: "parda:configure",
			render: (label) => (
				<Link to="/admin/parda/sources/$id" params={{ id: row.id }}>
					{label}
				</Link>
			),
		},
		{
			id: "lab",
			label: m.pd_admin_source_test(),
			permission: "parda:configure",
			render: (label) => (
				<Link to="/admin/parda/player-lab" search={{ source: row.id }}>
					{label}
				</Link>
			),
		},
		{
			id: "enable",
			label: row.enabled ? m.pd_admin_source_disable() : m.pd_admin_source_enable(),
			permission: "parda:configure",
			separated: true,
			onSelect: () =>
				change(row, { enabled: !row.enabled }, () =>
					row.enabled
						? m.pd_admin_source_disabled_toast({ name: name(row) })
						: m.pd_admin_source_enabled_toast({ name: name(row) }),
				),
		},
		{
			id: "pin",
			label: row.pinned ? m.pd_admin_source_unpin() : m.pd_admin_source_pin(),
			permission: "parda:configure",
			onSelect: () =>
				change(row, { pinned: !row.pinned }, () =>
					row.pinned
						? m.pd_admin_source_unpinned_toast({ name: name(row) })
						: m.pd_admin_source_pinned_toast({ name: name(row) }),
				),
		},
	];

	const actions = (
		<>
			{canConfigure && rows.length > 1 ? (
				<Button variant="outline" onClick={() => setReordering(true)} data-testid="parda-sources-reorder">
					<ArrowDownUpIcon aria-hidden />
					{m.pd_admin_sources_reorder()}
				</Button>
			) : null}
			<NewSourceButton />
		</>
	);

	return (
		<CrudListPage
			title={m.pd_admin_sources_title()}
			description={m.pd_admin_sources_description()}
			actions={actions}
			notice={
				<div className="grid gap-3 lg:grid-cols-2">
					<PlaybackSwitch />
					<SourceOrderSwitch />
				</div>
			}
			tableId={SOURCES_TABLE_ID}
			list={{ rows }}
			columns={columns}
			getRowLabel={name}
			rowActions={rowActions}
			remove={{
				permission: "parda:configure",
				run: (ids) => remove.mutateAsync(ids),
				description: m.pd_admin_source_delete_body,
			}}
			empty={{ description: m.pd_admin_sources_empty(), action: <NewSourceButton /> }}
			exportName="parda-sources"
			data-testid="parda-sources-table"
		>
			{reordering ? (
				<Suspense fallback={null}>
					<ReorderSourcesDialog sources={rows} onClose={() => setReordering(false)} />
				</Suspense>
			) : null}
		</CrudListPage>
	);
}

/** The sources' query holds the whole list, not pages: these patch it as a list. */
const withoutRowsOf = (rows: AdminSource[], ids: string[]) => rows.filter((row) => !ids.includes(row.id));
const patchList =
	<V extends { id: string }>(patch: (row: AdminSource, variables: V) => AdminSource) =>
	(rows: AdminSource[], variables: V) =>
		rows.map((row) => (row.id === variables.id ? patch(row, variables) : row));
