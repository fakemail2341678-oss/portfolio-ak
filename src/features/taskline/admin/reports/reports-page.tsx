import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { RelativeTime } from "@/components/data-display/relative-time";
import { StatusOf } from "@/components/data-display/status-badge";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Page, PageHeader } from "@/components/page/page";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineColor } from "../../colors";
import { RANGE_LABELS, ReportRangeNav } from "../../reports/report-parts";
import { formatDuration } from "../../time/duration";
import type { ReportRange } from "../../types";
import { PROJECT_HEALTH } from "../labels";
import { adminReportsQueryOptions } from "../queries";
import type { AdminReportHealth, AdminReports, AdminReportTime, AdminReportWorkload } from "../schema";

const route = getRouteApi("/_admin/admin/taskline/reports");

const percent = (value: number) => formatNumber(value, { style: "percent" });
const NUMBER_CELL = "text-end tabular-nums";

const healthColumns = (now: number): ReadonlyArray<DataTableColumn<AdminReportHealth>> => [
	{
		id: "project",
		header: m.taskline_admin_col_project,
		cellClassName: "max-w-72",
		cell: (row) => (
			<Link
				to="/admin/taskline/projects/$id"
				params={{ id: row.id }}
				className="flex min-w-0 items-center gap-2 font-medium hover:underline"
			>
				<span className="size-2.5 shrink-0 rounded-full" style={{ background: tasklineColor(row.color) }} aria-hidden />
				<span className="font-mono text-muted-foreground text-xs">{row.key}</span>
				<span className="truncate">{row.name}</span>
			</Link>
		),
		csv: (row) => `${row.key} ${row.name}`,
	},
	{
		id: "health",
		header: m.taskline_project_health,
		cell: (row) =>
			row.health ? (
				<StatusOf status={row.health} map={PROJECT_HEALTH} />
			) : (
				<span className="text-muted-foreground">{m.taskline_health_none()}</span>
			),
		csv: (row) => (row.health ? PROJECT_HEALTH[row.health].label() : ""),
	},
	{
		id: "progress",
		header: m.taskline_report_col_progress,
		cell: (row) =>
			row.progress === null ? (
				<span className="text-muted-foreground">–</span>
			) : (
				<span className="flex min-w-24 items-center gap-2">
					<span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
						<span className="block h-full bg-primary" style={{ width: `${row.progress * 100}%` }} />
					</span>
					<span className="text-caption tabular-nums">{percent(row.progress)}</span>
				</span>
			),
		csv: (row) => (row.progress === null ? "" : Math.round(row.progress * 100)),
	},
	{
		id: "overdue",
		header: m.taskline_report_overdue_series,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => (
			<span className={row.overdue > 0 ? "text-destructive" : undefined}>{formatNumber(row.overdue)}</span>
		),
		csv: (row) => row.overdue,
	},
	{
		id: "milestones",
		header: m.taskline_report_col_at_risk,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => (
			<span className={row.milestonesAtRisk > 0 ? "text-warning" : undefined}>
				{formatNumber(row.milestonesAtRisk)}
			</span>
		),
		csv: (row) => row.milestonesAtRisk,
	},
	{
		id: "activity",
		header: m.taskline_report_col_activity,
		cell: (row) =>
			row.lastActivityAt ? (
				<RelativeTime value={row.lastActivityAt} now={now} />
			) : (
				<span className="text-muted-foreground">–</span>
			),
		csv: (row) => row.lastActivityAt,
	},
	{
		id: "update",
		header: m.taskline_report_col_update,
		cell: (row) =>
			row.update ? (
				<span className="flex flex-col">
					<RelativeTime value={row.update.at} now={now} />
					<span className="text-caption text-muted-foreground">{row.update.author ?? m.taskline_activity_admin()}</span>
				</span>
			) : (
				<span className="text-muted-foreground">{m.taskline_report_no_update()}</span>
			),
		csv: (row) => row.update?.at ?? "",
	},
];

/** Work due within a week against a week's capacity: the bar shows it, over in the warning colour. */
function Load({ row }: { row: AdminReportWorkload }) {
	const share = row.capacityMinutes > 0 ? row.dueSoonMinutes / row.capacityMinutes : 0;
	return (
		<span className="flex min-w-32 items-center gap-2">
			<span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
				<span
					className={cn("block h-full", share > 1 ? "bg-warning" : "bg-primary")}
					style={{ width: `${Math.min(100, share * 100)}%` }}
				/>
			</span>
			<span className={cn("text-caption tabular-nums", share > 1 && "text-warning")}>{percent(share)}</span>
		</span>
	);
}

const WORKLOAD_COLUMNS: ReadonlyArray<DataTableColumn<AdminReportWorkload>> = [
	{ id: "member", header: m.taskline_report_col_member, cell: (row) => row.name, csv: (row) => row.name },
	{
		id: "open",
		header: m.taskline_report_col_open,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatNumber(row.open),
		csv: (row) => row.open,
	},
	{
		id: "overdue",
		header: m.taskline_report_overdue_series,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatNumber(row.overdue),
		csv: (row) => row.overdue,
	},
	{
		id: "estimate",
		header: m.taskline_report_col_estimate_open,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatDuration(row.estimateMinutes),
		csv: (row) => row.estimateMinutes,
	},
	{
		id: "soon",
		header: m.taskline_report_col_due_soon,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatDuration(row.dueSoonMinutes),
		csv: (row) => row.dueSoonMinutes,
	},
	{
		id: "capacity",
		header: m.taskline_report_col_capacity,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatDuration(row.capacityMinutes),
		csv: (row) => row.capacityMinutes,
	},
	{ id: "load", header: m.taskline_report_col_load, cell: (row) => <Load row={row} /> },
];

const timeColumns = (label: () => string): ReadonlyArray<DataTableColumn<AdminReportTime>> => [
	{ id: "label", header: label, cell: (row) => row.label, csv: (row) => row.label },
	{
		id: "logged",
		header: m.taskline_time_logged_label,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatDuration(row.minutes),
		csv: (row) => row.minutes,
	},
	{
		id: "billable",
		header: m.taskline_time_billable_label,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatDuration(row.billableMinutes),
		csv: (row) => row.billableMinutes,
	},
];

/**
 * /admin/taskline/reports (Task 57, decision 0225; `taskline:read`): how the team's
 * projects are doing, each member's work against their capacity, and the time logged
 * over `?range=` weeks. Each table saves as CSV.
 */
export function TasklineReportsPage() {
	const { range } = route.useSearch();
	const { data } = useSuspenseQuery(adminReportsQueryOptions(range));
	return <AdminReportsView data={data} range={range} />;
}

/** The team's reports, from what the page read. */
export function AdminReportsView({ data, range }: { data: AdminReports; range: ReportRange }) {
	const now = useMinuteClock(Date.parse(data.readAt));
	const stamp = data.today;
	const empty = (text: string) => <p className="p-6 text-center text-muted-foreground">{text}</p>;
	return (
		<Page width="admin" data-testid="taskline-admin-reports">
			<PageHeader
				title={m.taskline_admin_reports_title()}
				description={m.taskline_admin_reports_description()}
				actions={
					<ReportRangeNav
						current={range}
						link={(each, props) => (
							<Link to="/admin/taskline/reports" search={{ range: each }} {...props}>
								{RANGE_LABELS[each]()}
							</Link>
						)}
					/>
				}
			/>
			<section aria-labelledby="report-health" className="flex flex-col gap-3">
				<h2 id="report-health" className="text-heading">
					{m.taskline_report_health_title()}
				</h2>
				<DataTable
					tableId="admin-taskline-report-health"
					rows={data.health}
					columns={healthColumns(now)}
					getRowId={(row) => row.id}
					getRowLabel={(row) => `${row.key} ${row.name}`}
					exportName={`taskline-health-${stamp}`}
					empty={empty(m.taskline_admin_health_empty())}
					data-testid="report-health-table"
				/>
			</section>
			<section aria-labelledby="report-capacity" className="flex flex-col gap-3">
				<div className="flex flex-col gap-1">
					<h2 id="report-capacity" className="text-heading">
						{m.taskline_report_capacity_title()}
					</h2>
					<p className="text-caption text-muted-foreground">{m.taskline_report_capacity_summary()}</p>
				</div>
				<DataTable
					tableId="admin-taskline-report-workload"
					rows={data.workload}
					columns={WORKLOAD_COLUMNS}
					getRowId={(row) => row.memberId}
					getRowLabel={(row) => row.name}
					exportName={`taskline-workload-${stamp}`}
					empty={empty(m.taskline_report_workload_empty())}
					scrollRegion
					scrollRegionLabel={m.taskline_report_capacity_table()}
					data-testid="report-capacity-table"
				/>
			</section>
			<section aria-labelledby="report-time" className="flex flex-col gap-3">
				<div className="flex flex-col gap-1">
					<h2 id="report-time" className="text-heading">
						{m.taskline_report_team_time_title()}
					</h2>
					<p className="text-caption text-muted-foreground">
						{m.taskline_report_team_time_summary({ from: formatDayMonth(data.from), to: formatDayMonth(data.today) })}
					</p>
				</div>
				<div className="grid gap-6 lg:grid-cols-2">
					<DataTable
						tableId="admin-taskline-report-time-projects"
						rows={data.timeByProject}
						columns={timeColumns(m.taskline_admin_col_project)}
						getRowId={(row) => row.id}
						getRowLabel={(row) => row.label}
						exportName={`taskline-time-projects-${stamp}`}
						empty={empty(m.taskline_report_time_empty())}
						scrollRegion
						scrollRegionLabel={m.taskline_report_time_by_project()}
						data-testid="report-time-projects"
					/>
					<DataTable
						tableId="admin-taskline-report-time-members"
						rows={data.timeByMember}
						columns={timeColumns(m.taskline_report_col_member)}
						getRowId={(row) => row.id}
						getRowLabel={(row) => row.label}
						exportName={`taskline-time-members-${stamp}`}
						empty={empty(m.taskline_report_time_empty())}
						scrollRegion
						scrollRegionLabel={m.taskline_report_time_by_member()}
						data-testid="report-time-members"
					/>
				</div>
			</section>
		</Page>
	);
}
