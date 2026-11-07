import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { CheckCheckIcon, CircleDashedIcon, FlagIcon, TimerIcon } from "lucide-react";
import { BarChart, LineChart } from "@/components/charts";
import { StatCard } from "@/components/data-display/stat-card";
import { NativeSelect } from "@/components/ui/native-select";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { projectTasksQueryOptions, sprintReportQueryOptions } from "../queries";
import type { SprintMeasure } from "../search";
import { StatusName, TaskTypeIcon } from "../task/task-bits";
import { formatDuration } from "../time/duration";
import { isClosedCategory, type SprintState } from "../types";
import { burnSeries } from "./burndown";
import {
	amountIn,
	amountText,
	daysLeft,
	dayText,
	measureLabel,
	measureOf,
	measuresOf,
	SprintDates,
} from "./sprint-bits";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/sprints/$sprintId");

const STATE_LABELS: Record<SprintState, () => string> = {
	planned: m.taskline_sprint_state_planned,
	active: m.taskline_sprint_state_active,
	completed: m.taskline_sprint_state_completed,
};

/**
 * /app/taskline/$ws/p/$key/sprints/$sprintId (Task 52): a sprint's report. Its numbers,
 * the burndown and burnup from the daily snapshots (0216), the project's velocity, and
 * the tasks in it. `?by=` counts points (or estimated hours) or tasks (default: the project's estimation).
 */
export function SprintReportPage() {
	const { session } = route.useRouteContext();
	const { ws, key, sprintId } = route.useParams();
	const search = route.useSearch();
	const navigate = useNavigate();
	const userId = session.user.id;
	const { data: report } = useSuspenseQuery(sprintReportQueryOptions(userId, ws, key, sprintId));
	const { data: project } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const { sprint } = report;
	const by: SprintMeasure = search.by ?? measureOf(report.estimation);
	const series = burnSeries(report, by);
	const rows = series.map((point) => ({
		day: point.day === null ? m.taskline_sprint_chart_start() : dayText(point.day),
		remaining: point.remaining,
		ideal: point.ideal,
		scope: point.scope,
		done: point.done,
	}));
	const latest = [...series].reverse().find((point) => point.remaining !== null) ?? series[0];
	const committed = sprint.committed ? amountIn(sprint.committed, by) : null;
	const closedIds = new Set(project.statuses.filter((status) => isClosedCategory(status.category)).map((s) => s.id));
	const tasks = project.tasks.filter((task) => task.sprintId === sprint.id);
	const velocity = report.velocity.map((row) => ({
		sprint: row.name,
		committed: amountIn({ points: row.committedPoints, tasks: row.committedTasks, minutes: row.committedMinutes }, by),
		completed: amountIn({ points: row.completedPoints, tasks: row.completedTasks, minutes: row.completedMinutes }, by),
	}));
	const amount = (value: number | null) => (value === null ? "–" : formatNumber(value));

	return (
		<div className="flex min-w-0 flex-col gap-6" data-testid="sprint-report">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="flex min-w-0 flex-col gap-1">
					<h2 className="flex flex-wrap items-center gap-2 text-heading">
						{sprint.name}
						<span
							className={cn(
								"rounded-full px-2 text-caption",
								sprint.state === "active" ? "bg-primary/10 text-primary" : "bg-surface-2 text-muted-foreground",
							)}
							data-testid="sprint-state"
						>
							{STATE_LABELS[sprint.state]()}
						</span>
					</h2>
					<SprintDates sprint={sprint} />
					{sprint.goal ? <p className="text-body text-muted-foreground">{sprint.goal}</p> : null}
				</div>
				<div className="flex flex-wrap items-end gap-3">
					<label htmlFor="sprint-switch" className="flex flex-col gap-1 text-caption text-muted-foreground">
						{m.taskline_sprint_switch()}
						<NativeSelect
							id="sprint-switch"
							value={sprint.id}
							onChange={(event) =>
								navigate({ ...tasklineLinks.sprint(ws, key, event.currentTarget.value), search: { by: search.by } })
							}
							data-testid="sprint-switch"
						>
							{report.sprints.map((each) => (
								<option key={each.id} value={each.id}>
									{`${each.name} (${STATE_LABELS[each.state]()})`}
								</option>
							))}
						</NativeSelect>
					</label>
					<nav aria-label={m.taskline_sprint_measure()} className="flex rounded-md border p-0.5">
						{measuresOf(report.estimation).map((measure) => (
							<Link
								key={measure}
								{...tasklineLinks.sprint(ws, key, sprint.id)}
								search={{ by: measure }}
								aria-current={by === measure ? "true" : undefined}
								className={cn(
									"rounded-sm px-3 py-1 text-caption outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
									by === measure ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
								)}
								data-testid={`sprint-by-${measure}`}
							>
								{measureLabel(measure)}
							</Link>
						))}
					</nav>
				</div>
			</div>

			<section aria-labelledby="sprint-numbers">
				<h3 id="sprint-numbers" className="sr-only">
					{m.taskline_sprint_numbers()}
				</h3>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						label={m.taskline_sprint_committed()}
						value={committed ?? 0}
						format={(value) => (committed === null ? "–" : formatNumber(value))}
						icon={FlagIcon}
					/>
					<StatCard
						label={sprint.state === "completed" ? m.taskline_sprint_completed_label() : m.taskline_sprint_done_so_far()}
						value={latest?.done ?? 0}
						format={(value) => amount(latest?.done === null ? null : value)}
						icon={CheckCheckIcon}
					/>
					<StatCard
						label={m.taskline_sprint_remaining()}
						value={latest?.remaining ?? 0}
						format={(value) => amount(latest?.remaining === null ? null : value)}
						icon={CircleDashedIcon}
					/>
					{sprint.state === "completed" && sprint.completedAt ? (
						<StatCard
							label={m.taskline_sprint_ended()}
							value={0}
							format={() => dayText((sprint.completedAt ?? "").slice(0, 10))}
							icon={TimerIcon}
						/>
					) : (
						<StatCard label={m.taskline_sprint_days_left()} value={daysLeft(sprint, report.today)} icon={TimerIcon} />
					)}
				</div>
			</section>

			{sprint.state === "planned" ? (
				<p
					className="rounded-lg border border-dashed p-6 text-center text-muted-foreground"
					data-testid="sprint-not-started"
				>
					{m.taskline_sprint_not_started()}
				</p>
			) : (
				<div className="grid gap-6 xl:grid-cols-2">
					<section aria-labelledby="sprint-burndown" className="flex flex-col gap-3 rounded-lg border p-4">
						<h3 id="sprint-burndown" className="text-heading">
							{m.taskline_sprint_burndown()}
						</h3>
						<LineChart
							label={m.taskline_sprint_burndown_label({ sprint: sprint.name })}
							data={rows}
							index="day"
							series={[
								{ key: "remaining", label: m.taskline_sprint_series_remaining() },
								{
									key: "ideal",
									label: m.taskline_sprint_series_ideal(),
									dashed: true,
									color: "var(--muted-foreground)",
								},
							]}
						/>
					</section>
					<section aria-labelledby="sprint-burnup" className="flex flex-col gap-3 rounded-lg border p-4">
						<h3 id="sprint-burnup" className="text-heading">
							{m.taskline_sprint_burnup()}
						</h3>
						<LineChart
							label={m.taskline_sprint_burnup_label({ sprint: sprint.name })}
							data={rows}
							index="day"
							series={[
								{ key: "scope", label: m.taskline_sprint_series_scope() },
								{ key: "done", label: m.taskline_sprint_series_done() },
							]}
						/>
					</section>
				</div>
			)}

			<section aria-labelledby="sprint-velocity" className="flex flex-col gap-3 rounded-lg border p-4">
				<h3 id="sprint-velocity" className="text-heading">
					{m.taskline_sprint_velocity()}
				</h3>
				{velocity.length === 0 ? (
					<p className="text-muted-foreground">{m.taskline_velocity_none()}</p>
				) : (
					<BarChart
						label={m.taskline_sprint_velocity_label()}
						data={velocity}
						index="sprint"
						series={[
							{ key: "committed", label: m.taskline_sprint_series_committed() },
							{ key: "completed", label: m.taskline_sprint_series_completed() },
						]}
					/>
				)}
			</section>

			<section aria-labelledby="sprint-tasks" className="flex flex-col gap-3">
				<h3 id="sprint-tasks" className="text-heading">
					{m.taskline_sprint_tasks_title()}
				</h3>
				{tasks.length === 0 ? (
					<p className="text-muted-foreground">{m.taskline_backlog_sprint_empty()}</p>
				) : (
					<ul className="flex flex-col divide-y rounded-lg border" data-testid="sprint-tasks">
						{tasks.map((task) => {
							const status = project.statuses.find((each) => each.id === task.statusId);
							const closed = closedIds.has(task.statusId);
							return (
								<li key={task.id} className="flex items-center gap-2 px-3 py-2">
									<TaskTypeIcon type={task.type} />
									<span className="w-16 shrink-0 font-mono text-caption text-muted-foreground">{task.ref}</span>
									<Link
										{...tasklineLinks.task(ws, task.ref)}
										className={cn(
											"min-w-0 flex-1 wrap-anywhere hover:underline",
											closed && "text-muted-foreground line-through",
										)}
									>
										{task.title}
									</Link>
									{status ? <StatusName status={status} /> : null}
									<span className="w-20 shrink-0 text-end text-caption text-muted-foreground tabular-nums">
										{report.estimation === "time"
											? task.estimateMinutes === null
												? "–"
												: formatDuration(task.estimateMinutes)
											: task.points === null
												? "–"
												: amountText(task.points, "points")}
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</section>
		</div>
	);
}
