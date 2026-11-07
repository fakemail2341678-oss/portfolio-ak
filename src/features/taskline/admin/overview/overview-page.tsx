import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	AlarmClockIcon,
	CircleCheckIcon,
	ClockIcon,
	FolderKanbanIcon,
	ListTodoIcon,
	MailIcon,
	UserRoundIcon,
	UsersIcon,
} from "lucide-react";
import { BarChart } from "@/components/charts";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusOf } from "@/components/data-display/status-badge";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Page, PageHeader } from "@/components/page/page";
import { formatDateTime, formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { TASKLINE_NAME } from "../../brand";
import { tasklineColor } from "../../colors";
import { ActiveSprintList } from "../../sprints/active-sprints";
import { formatDuration, hoursOf } from "../../time/duration";
import { PROJECT_HEALTH, PROJECT_STATUS } from "../labels";
import { tasklineOverviewQueryOptions } from "../queries";
import type { AdminProjectHealthRow } from "../schema";

const day = (value: string) => formatDayMonth(value);
const percent = (value: number) => formatNumber(value, { style: "percent" });

const columns: ReadonlyArray<DataTableColumn<AdminProjectHealthRow>> = [
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
	},
	{
		id: "status",
		header: m.taskline_project_status,
		cell: (row) => <StatusOf status={row.status} map={PROJECT_STATUS} />,
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
	},
	{
		id: "update",
		header: m.taskline_report_col_update,
		cell: (row) =>
			row.updatedOn ? (
				formatDateTime(row.updatedOn)
			) : (
				<span className="text-muted-foreground">{m.taskline_report_no_update()}</span>
			),
	},
	{
		id: "lead",
		header: m.taskline_admin_col_lead,
		cell: (row) => row.lead ?? <span className="text-muted-foreground">{m.taskline_admin_no_lead()}</span>,
	},
	{
		id: "open",
		header: m.taskline_admin_col_open,
		cellClassName: "text-end tabular-nums",
		cell: (row) => formatNumber(row.open),
	},
	{
		id: "overdue",
		header: m.taskline_admin_col_overdue,
		cellClassName: "text-end tabular-nums",
		cell: (row) => (
			<span className={row.overdue > 0 ? "font-medium text-destructive" : undefined}>{formatNumber(row.overdue)}</span>
		),
	},
	{
		id: "done",
		header: m.taskline_admin_col_progress,
		cellClassName: "text-end tabular-nums",
		cell: (row) => percent(row.done + row.open === 0 ? 0 : row.done / (row.done + row.open)),
	},
	{
		id: "target",
		header: m.taskline_project_target,
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => (row.targetOn ? day(row.targetOn) : "—"),
	},
];

/**
 * /admin/taskline: the team at a glance. Active projects and their work, the last
 * twelve weeks of created against completed, each project's health, the people, and
 * the sandboxes as counts (what is in them is their owners').
 */
export function TasklineOverviewPage() {
	const { data } = useSuspenseQuery(tasklineOverviewQueryOptions());
	const weeks = data.weeks.map((week) => ({ week: day(week.week), created: week.created, completed: week.completed }));
	return (
		<Page width="admin" data-testid="taskline-admin-overview">
			<PageHeader title={TASKLINE_NAME} description={m.taskline_admin_overview_description()} />
			<section aria-labelledby="tl-admin-stats">
				<h2 id="tl-admin-stats" className="sr-only">
					{m.dashboard_stats_title()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						label={m.taskline_admin_stat_projects()}
						value={data.stats.activeProjects}
						icon={FolderKanbanIcon}
						to="/admin/taskline/projects"
					/>
					<StatCard label={m.taskline_admin_stat_open()} value={data.stats.openTasks} icon={ListTodoIcon} />
					<StatCard label={m.taskline_admin_stat_overdue()} value={data.stats.overdueTasks} icon={AlarmClockIcon} />
					<StatCard
						label={m.taskline_admin_stat_done_week()}
						value={data.stats.doneThisWeek}
						icon={CircleCheckIcon}
						trend={data.weeks.map((week) => week.completed)}
					/>
				</div>
			</section>
			<section aria-labelledby="tl-admin-weeks" className="flex flex-col gap-3 rounded-lg border p-4">
				<h2 id="tl-admin-weeks" className="text-heading">
					{m.taskline_admin_weeks_title()}
				</h2>
				<BarChart
					label={m.taskline_admin_weeks_label()}
					data={weeks}
					index="week"
					series={[
						{ key: "created", label: m.taskline_admin_series_created() },
						{ key: "completed", label: m.taskline_admin_series_completed() },
					]}
				/>
			</section>
			<section aria-labelledby="tl-admin-health" className="flex flex-col gap-3">
				<h2 id="tl-admin-health" className="text-heading">
					{m.taskline_admin_health_title()}
				</h2>
				<DataTable
					tableId="admin-taskline-health"
					rows={data.projects}
					columns={columns}
					getRowId={(row) => row.id}
					getRowLabel={(row) => `${row.key} ${row.name}`}
					empty={<p className="p-6 text-center text-muted-foreground">{m.taskline_admin_health_empty()}</p>}
					data-testid="taskline-admin-health"
				/>
			</section>
			<section aria-labelledby="tl-admin-sprints" className="flex flex-col gap-3">
				<h2 id="tl-admin-sprints" className="text-heading">
					{m.taskline_admin_sprints_title()}
				</h2>
				{data.sprints.length === 0 ? (
					<p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
						{m.taskline_admin_sprints_empty()}
					</p>
				) : (
					<ActiveSprintList
						sprints={data.sprints}
						today={data.today}
						className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
					/>
				)}
			</section>
			<section aria-labelledby="tl-admin-people" className="flex flex-col gap-3">
				<h2 id="tl-admin-people" className="text-heading">
					{m.taskline_admin_people_title()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						label={m.taskline_admin_stat_members()}
						value={data.members.active}
						icon={UsersIcon}
						to="/admin/taskline/members"
					/>
					<StatCard label={m.taskline_admin_stat_invited()} value={data.members.invited} icon={MailIcon} />
					<StatCard
						label={m.taskline_admin_stat_logged_week()}
						value={hoursOf(data.members.loggedThisWeek)}
						format={() => formatDuration(data.members.loggedThisWeek)}
						icon={ClockIcon}
					/>
					<StatCard
						label={m.taskline_admin_stat_sandboxes()}
						value={data.sandboxes.total}
						icon={UserRoundIcon}
						hint={m.taskline_admin_sandboxes_hint({
							guests: formatNumber(data.sandboxes.guests),
							projects: formatNumber(data.sandboxes.projects),
							tasks: formatNumber(data.sandboxes.tasks),
						})}
					/>
				</div>
			</section>
		</Page>
	);
}
