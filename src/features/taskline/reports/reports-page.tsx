import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { AlarmClockIcon, ChartColumnIcon, CircleCheckIcon, GaugeIcon, HourglassIcon } from "lucide-react";
import { AreaChart, BarChart, DonutChart, LineChart } from "@/components/charts";
import { StatCard } from "@/components/data-display/stat-card";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/page/empty-state";
import { formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { tasklineColor } from "../colors";
import { PRIORITY_LABELS } from "../labels";
import { tasklineLinks } from "../links";
import { projectReportsQueryOptions } from "../queries";
import { formatDuration, hoursOf } from "../time/duration";
import type { ProjectReports, ReportCycleTask, ReportRange, ReportWorkloadRow, TaskPriority } from "../types";
import { RANGE_LABELS, ReportCard, ReportRangeNav } from "./report-parts";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/reports");

/** The slowest completed tasks shown; the CSV has them all. */
const SLOWEST_SHOWN = 10;

const PRIORITY_COLORS: Record<TaskPriority, string> = {
	0: tasklineColor("gray"),
	1: tasklineColor("blue"),
	2: tasklineColor("amber"),
	3: tasklineColor("orange"),
	4: tasklineColor("red"),
};

const days = (value: number | null) =>
	value === null ? "–" : m.taskline_report_days({ days: formatNumber(value, { maximumFractionDigits: 1 }) });

/**
 * A project's reports (/$ws/p/$key/reports, Task 57, decision 0225): where its tasks are,
 * what came in and went out each week, how long work takes, what's overdue, who holds
 * what, and time against estimate when it's tracked. `?range=` is how many weeks. Each
 * report saves its numbers as CSV.
 */
export function ProjectReportsPage() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const { range } = route.useSearch();
	const { data } = useSuspenseQuery(projectReportsQueryOptions(session.user.id, ws, key, range));
	return <ProjectReportsView data={data} ws={ws} projectKey={key} range={range} />;
}

/** The reports themselves, from what the page read. */
export function ProjectReportsView({
	data,
	ws,
	projectKey: key,
	range,
}: {
	data: ProjectReports;
	ws: string;
	projectKey: string;
	range: ReportRange;
}) {
	const file = (name: string) => `${key.toLowerCase()}-${name}-${data.today}`;
	const hasTasks = data.statuses.some((status) => status.count > 0);
	const weeks = data.weeks.map((week) => ({ ...week, label: formatDayMonth(week.week) }));
	const completed = data.weeks.reduce((total, week) => total + week.completed, 0);
	const created = data.weeks.reduce((total, week) => total + week.created, 0);
	const overdueNow = data.workload.reduce((total, row) => total + row.overdue, 0);
	const slowest = [...data.cycle.tasks]
		.sort((a, b) => (b.cycleDays ?? b.leadDays) - (a.cycleDays ?? a.leadDays))
		.slice(0, SLOWEST_SHOWN);
	const weekColumn = {
		header: m.taskline_report_col_week(),
		value: (row: (typeof data.weeks)[number]) => row.week,
	};
	return (
		<div className="flex min-w-0 flex-col gap-6" data-testid="project-reports">
			<ReportRangeNav
				current={range}
				link={(each, props) => (
					<Link {...tasklineLinks.reports(ws, key)} search={{ range: each }} {...props}>
						{RANGE_LABELS[each]()}
					</Link>
				)}
			/>
			{hasTasks ? null : <EmptyState icon={ChartColumnIcon} description={m.taskline_report_empty()} />}
			<section aria-labelledby="report-numbers">
				<h2 id="report-numbers" className="sr-only">
					{m.taskline_report_numbers()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard label={m.taskline_report_completed()} value={completed} icon={CircleCheckIcon} />
					<StatCard label={m.taskline_report_overdue_now()} value={overdueNow} icon={AlarmClockIcon} />
					<StatCard
						label={m.taskline_report_median_cycle()}
						value={data.cycle.medianCycleDays ?? 0}
						format={() => days(data.cycle.medianCycleDays)}
						icon={GaugeIcon}
					/>
					<StatCard
						label={m.taskline_report_median_lead()}
						value={data.cycle.medianLeadDays ?? 0}
						format={() => days(data.cycle.medianLeadDays)}
						icon={HourglassIcon}
					/>
				</div>
			</section>
			<div className="grid gap-6 lg:grid-cols-2">
				<ReportCard
					id="status"
					title={m.taskline_report_status_title()}
					filename={file("status")}
					rows={data.statuses}
					columns={[
						{ header: m.taskline_field_status(), value: (row) => row.name },
						{ header: m.taskline_report_col_tasks(), value: (row) => row.count },
					]}
				>
					<DonutChart
						label={m.taskline_report_status_label()}
						index="name"
						series={[{ key: "count", label: m.taskline_report_col_tasks() }]}
						colors={data.statuses.map((status) => tasklineColor(status.color))}
						data={data.statuses.map(({ name, count }) => ({ name, count }))}
					/>
				</ReportCard>
				<ReportCard
					id="priority"
					title={m.taskline_report_priority_title()}
					summary={m.taskline_report_priority_summary()}
					filename={file("priority")}
					rows={data.priorities}
					columns={[
						{ header: m.taskline_field_priority(), value: (row) => PRIORITY_LABELS[row.priority]() },
						{ header: m.taskline_report_col_tasks(), value: (row) => row.count },
					]}
				>
					<DonutChart
						label={m.taskline_report_priority_label()}
						index="name"
						series={[{ key: "count", label: m.taskline_report_col_tasks() }]}
						colors={data.priorities.map((row) => PRIORITY_COLORS[row.priority])}
						data={data.priorities.map((row) => ({ name: PRIORITY_LABELS[row.priority](), count: row.count }))}
					/>
				</ReportCard>
			</div>
			<ReportCard
				id="flow"
				title={m.taskline_report_flow_title()}
				summary={m.taskline_report_flow_summary({ created: formatNumber(created), completed: formatNumber(completed) })}
				filename={file("created-completed")}
				rows={data.weeks}
				columns={[
					weekColumn,
					{ header: m.taskline_admin_series_created(), value: (row) => row.created },
					{ header: m.taskline_admin_series_completed(), value: (row) => row.completed },
				]}
			>
				<LineChart
					label={m.taskline_report_flow_label()}
					index="label"
					data={weeks}
					series={[
						{ key: "created", label: m.taskline_admin_series_created() },
						{ key: "completed", label: m.taskline_admin_series_completed() },
					]}
				/>
			</ReportCard>
			<div className="grid gap-6 lg:grid-cols-2">
				<ReportCard
					id="throughput"
					title={m.taskline_report_throughput_title()}
					summary={m.taskline_report_throughput_summary({
						average: formatNumber(completed / Math.max(1, data.weeks.length), { maximumFractionDigits: 1 }),
					})}
					filename={file("throughput")}
					rows={data.weeks}
					columns={[weekColumn, { header: m.taskline_report_completed(), value: (row) => row.completed }]}
				>
					<BarChart
						label={m.taskline_report_throughput_label()}
						index="label"
						data={weeks}
						series={[{ key: "completed", label: m.taskline_report_completed() }]}
					/>
				</ReportCard>
				<ReportCard
					id="overdue"
					title={m.taskline_report_overdue_title()}
					summary={m.taskline_report_overdue_summary()}
					filename={file("overdue")}
					rows={data.weeks}
					columns={[weekColumn, { header: m.taskline_report_overdue_series(), value: (row) => row.overdue }]}
				>
					<AreaChart
						label={m.taskline_report_overdue_label()}
						index="label"
						data={weeks}
						series={[{ key: "overdue", label: m.taskline_report_overdue_series(), color: "var(--destructive)" }]}
					/>
				</ReportCard>
			</div>
			<ReportCard
				id="cycle"
				title={m.taskline_report_cycle_title()}
				summary={m.taskline_report_cycle_summary({ p85: days(data.cycle.p85CycleDays) })}
				filename={file("cycle")}
				rows={data.cycle.tasks}
				columns={[
					{ header: m.taskline_timesheet_task(), value: (row) => row.ref },
					{ header: m.taskline_report_col_title(), value: (row) => row.title },
					{ header: m.taskline_report_col_completed_on(), value: (row) => row.completedOn },
					{ header: m.taskline_report_col_cycle(), value: (row) => row.cycleDays },
					{ header: m.taskline_report_col_lead(), value: (row) => row.leadDays },
				]}
			>
				<DataTable
					tableId={`report-cycle-${key}`}
					rows={slowest}
					columns={cycleColumns(ws)}
					getRowId={(row) => row.ref}
					getRowLabel={(row) => `${row.ref} ${row.title}`}
					empty={<p className="p-6 text-center text-muted-foreground">{m.taskline_report_cycle_empty()}</p>}
					data-testid="report-cycle-table"
				/>
			</ReportCard>
			<ReportCard
				id="workload"
				title={m.taskline_report_workload_title()}
				filename={file("workload")}
				rows={data.workload}
				columns={[
					{ header: m.taskline_field_assignee(), value: (row) => row.name ?? m.taskline_unassigned() },
					{ header: m.taskline_report_col_open(), value: (row) => row.open },
					{ header: m.taskline_report_overdue_series(), value: (row) => row.overdue },
					{ header: m.taskline_field_estimate(), value: (row) => formatDuration(row.estimateMinutes) },
					{ header: m.taskline_field_points(), value: (row) => row.points },
				]}
			>
				<DataTable
					tableId={`report-workload-${key}`}
					rows={data.workload}
					columns={WORKLOAD_COLUMNS}
					getRowId={(row) => row.memberId ?? "none"}
					getRowLabel={(row) => row.name ?? m.taskline_unassigned()}
					empty={<p className="p-6 text-center text-muted-foreground">{m.taskline_report_workload_empty()}</p>}
					scrollRegion
					data-testid="report-workload-table"
				/>
			</ReportCard>
			{data.time ? (
				<ReportCard
					id="time"
					title={m.taskline_report_time_title()}
					summary={m.taskline_report_time_summary({
						logged: formatDuration(data.time.totals.loggedMinutes),
						estimate: formatDuration(data.time.totals.estimateMinutes),
					})}
					filename={file("time")}
					rows={data.time.tasks}
					columns={[
						{ header: m.taskline_timesheet_task(), value: (row) => row.ref },
						{ header: m.taskline_report_col_title(), value: (row) => row.title },
						{ header: m.taskline_field_estimate(), value: (row) => row.estimateMinutes },
						{ header: m.taskline_time_logged_label(), value: (row) => row.loggedMinutes },
					]}
				>
					<BarChart
						label={m.taskline_report_time_label()}
						index="name"
						format={(hours) => formatDuration(Math.round(hours * 60))}
						data={data.time.members.map((member) => ({
							name: member.name,
							estimate: hoursOf(member.estimateMinutes),
							logged: hoursOf(member.loggedMinutes),
						}))}
						series={[
							{ key: "estimate", label: m.taskline_field_estimate() },
							{ key: "logged", label: m.taskline_time_logged_label() },
						]}
					/>
				</ReportCard>
			) : null}
		</div>
	);
}

const NUMBER_CELL = "text-end tabular-nums";

const cycleColumns = (ws: string): ReadonlyArray<DataTableColumn<ReportCycleTask>> => [
	{
		id: "task",
		header: m.taskline_timesheet_task,
		cellClassName: "max-w-96",
		cell: (row) => (
			<Link {...tasklineLinks.task(ws, row.ref)} className="block truncate hover:underline">
				<span className="font-mono text-caption text-muted-foreground">{row.ref}</span> {row.title}
			</Link>
		),
	},
	{ id: "completed", header: m.taskline_report_col_completed_on, cell: (row) => formatDayMonth(row.completedOn) },
	{
		id: "cycle",
		header: m.taskline_report_col_cycle,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => days(row.cycleDays),
	},
	{
		id: "lead",
		header: m.taskline_report_col_lead,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => days(row.leadDays),
	},
];

const WORKLOAD_COLUMNS: ReadonlyArray<DataTableColumn<ReportWorkloadRow>> = [
	{
		id: "assignee",
		header: m.taskline_field_assignee,
		cell: (row) => row.name ?? <span className="text-muted-foreground">{m.taskline_unassigned()}</span>,
	},
	{
		id: "open",
		header: m.taskline_report_col_open,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatNumber(row.open),
	},
	{
		id: "overdue",
		header: m.taskline_report_overdue_series,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatNumber(row.overdue),
	},
	{
		id: "estimate",
		header: m.taskline_field_estimate,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatDuration(row.estimateMinutes),
	},
	{
		id: "points",
		header: m.taskline_field_points,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatNumber(row.points),
	},
];
