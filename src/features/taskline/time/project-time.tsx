import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ClockIcon, HourglassIcon, ReceiptIcon, TargetIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import { ScrollRegion } from "@/components/data-display/scroll-region";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { useCloseOverlay } from "@/components/navigation/use-close-overlay";
import { EmptyState } from "@/components/page/empty-state";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { projectTasksQueryOptions, projectTimeQueryOptions } from "../queries";
import { PROJECT_TIME_VIEWS } from "../search";
import { Assignee } from "../task/task-bits";
import { TaskSheetLink } from "../task/task-link";
import type { ProjectTime, TasklineMember } from "../types";
import { formatDuration, hoursOf } from "./duration";

const TaskSheet = lazy(() => import("../task/task-sheet"));
const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/time");

/**
 * A project's time (/$ws/p/$key/time, Task 53): estimate against what was logged, by
 * task or by member (`?by=`), and the newest entries. The project layout drew the
 * header; the project's "Track time" setting shows or hides the tab.
 */
export function ProjectTimePage() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const search = route.useSearch();
	const userId = session.user.id;
	const { data: time } = useSuspenseQuery(projectTimeQueryOptions(userId, ws, key));
	const { data: project } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const closeTask = useCloseOverlay({ task: undefined });
	const { totals } = time;
	const nothing = totals.loggedMinutes === 0 && totals.estimateMinutes === 0;
	return (
		<div className="flex min-w-0 flex-col gap-6" data-testid="project-time">
			{project.project.settings.time ? null : (
				<p className="rounded-md border bg-surface-1 px-3 py-2 text-body text-muted-foreground" data-testid="time-off">
					{m.taskline_time_off()}
				</p>
			)}
			<section aria-labelledby="time-numbers">
				<h2 id="time-numbers" className="sr-only">
					{m.taskline_time_numbers()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						label={m.taskline_time_estimated()}
						value={hoursOf(totals.estimateMinutes)}
						format={() => formatDuration(totals.estimateMinutes)}
						icon={TargetIcon}
					/>
					<StatCard
						label={m.taskline_time_logged_label()}
						value={hoursOf(totals.loggedMinutes)}
						format={() => formatDuration(totals.loggedMinutes)}
						icon={ClockIcon}
					/>
					<StatCard
						label={m.taskline_time_billable_label()}
						value={hoursOf(totals.billableMinutes)}
						format={() => formatDuration(totals.billableMinutes)}
						icon={ReceiptIcon}
					/>
					<StatCard
						label={m.taskline_time_remaining()}
						value={hoursOf(Math.max(0, totals.estimateMinutes - totals.loggedMinutes))}
						format={() => formatDuration(Math.max(0, totals.estimateMinutes - totals.loggedMinutes))}
						icon={HourglassIcon}
					/>
				</div>
				{time.orphanMinutes > 0 ? (
					<p className="mt-2 text-caption text-muted-foreground">
						{m.taskline_time_orphan({ duration: formatDuration(time.orphanMinutes) })}
					</p>
				) : null}
			</section>
			{nothing ? (
				<EmptyState icon={ClockIcon} description={m.taskline_time_project_empty()} data-testid="project-time-empty" />
			) : (
				<>
					<nav aria-label={m.taskline_time_by()} className="flex w-fit rounded-md border p-0.5">
						{PROJECT_TIME_VIEWS.map((view) => (
							<Link
								key={view}
								{...tasklineLinks.time(ws, key)}
								search={{ by: view }}
								aria-current={search.by === view ? "true" : undefined}
								className={cn(
									"rounded-sm px-3 py-1 text-caption outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
									search.by === view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
								)}
								data-testid={`time-by-${view}`}
							>
								{view === "task" ? m.taskline_time_by_task() : m.taskline_time_by_member()}
							</Link>
						))}
					</nav>
					{search.by === "member" ? <ByMember time={time} /> : <ByTask time={time} ws={ws} members={project.members} />}
					<Entries time={time} />
				</>
			)}
			<Suspense fallback={null}>
				{search.task ? (
					<TaskSheet userId={userId} ws={ws} projectKey={key} taskRef={search.task} onClose={closeTask} />
				) : null}
			</Suspense>
		</div>
	);
}

/** Logged against an estimate: a bar and what's left or over. */
function Against({ logged, estimate }: { logged: number; estimate: number | null }) {
	if (estimate === null || estimate === 0) return <span className="text-muted-foreground">–</span>;
	const over = logged > estimate;
	return (
		<span className="flex min-w-28 flex-col gap-1">
			<span className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
				<span
					className={cn("block h-full", over ? "bg-warning" : "bg-primary")}
					style={{ width: `${Math.min(100, (logged / estimate) * 100)}%` }}
				/>
			</span>
			<span className={cn("text-caption tabular-nums", over ? "text-warning" : "text-muted-foreground")}>
				{over
					? m.taskline_time_over({ over: formatDuration(logged - estimate) })
					: m.taskline_time_left({ left: formatDuration(estimate - logged) })}
			</span>
		</span>
	);
}

const TH = "px-3 py-2 text-start font-medium text-caption text-muted-foreground";
const NUM = "px-3 py-2 text-end tabular-nums";

function ByTask({ time, ws, members }: { time: ProjectTime; ws: string; members: ReadonlyArray<TasklineMember> }) {
	return (
		<ScrollRegion className="rounded-lg border">
			<table className="w-full min-w-[40rem] border-collapse text-body" data-testid="time-by-task-table">
				<caption className="sr-only">{m.taskline_time_by_task_caption()}</caption>
				<thead>
					<tr className="border-b bg-surface-1">
						<th scope="col" className={TH}>
							{m.taskline_timesheet_task()}
						</th>
						<th scope="col" className={TH}>
							{m.taskline_field_assignee()}
						</th>
						<th scope="col" className={cn(TH, "text-end")}>
							{m.taskline_field_estimate()}
						</th>
						<th scope="col" className={cn(TH, "text-end")}>
							{m.taskline_time_logged_label()}
						</th>
						<th scope="col" className={TH}>
							{m.taskline_time_against()}
						</th>
					</tr>
				</thead>
				<tbody>
					{time.tasks.map((task) => (
						<tr key={task.taskId} className="border-b last:border-b-0" data-testid="time-task-row">
							<th scope="row" className="max-w-0 px-3 py-2 text-start font-normal">
								<TaskSheetLink
									view="time"
									ws={ws}
									taskRef={task.ref}
									className={cn("block truncate hover:underline", task.closed && "text-muted-foreground line-through")}
								>
									<span className="font-mono text-caption text-muted-foreground">{task.ref}</span> {task.title}
								</TaskSheetLink>
							</th>
							<td className="px-3 py-2">
								<Assignee member={members.find((member) => member.id === task.assigneeId)} />
							</td>
							<td className={NUM}>{task.estimateMinutes === null ? "–" : formatDuration(task.estimateMinutes)}</td>
							<td className={NUM}>{formatDuration(task.loggedMinutes)}</td>
							<td className="px-3 py-2">
								<Against logged={task.loggedMinutes} estimate={task.estimateMinutes} />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</ScrollRegion>
	);
}

function ByMember({ time }: { time: ProjectTime }) {
	return (
		<ScrollRegion className="rounded-lg border">
			<table className="w-full min-w-[36rem] border-collapse text-body" data-testid="time-by-member-table">
				<caption className="sr-only">{m.taskline_time_by_member_caption()}</caption>
				<thead>
					<tr className="border-b bg-surface-1">
						<th scope="col" className={TH}>
							{m.taskline_time_member()}
						</th>
						<th scope="col" className={cn(TH, "text-end")}>
							{m.taskline_time_assigned_estimate()}
						</th>
						<th scope="col" className={cn(TH, "text-end")}>
							{m.taskline_time_logged_label()}
						</th>
						<th scope="col" className={cn(TH, "text-end")}>
							{m.taskline_time_billable_label()}
						</th>
					</tr>
				</thead>
				<tbody>
					{time.members.map((member) => (
						<tr key={member.memberId} className="border-b last:border-b-0" data-testid="time-member-row">
							<th scope="row" className="px-3 py-2 text-start font-normal">
								{member.name}
							</th>
							<td className={NUM}>{formatDuration(member.estimateMinutes)}</td>
							<td className={NUM}>{formatDuration(member.loggedMinutes)}</td>
							<td className={NUM}>{formatDuration(member.billableMinutes)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</ScrollRegion>
	);
}

function Entries({ time }: { time: ProjectTime }) {
	if (time.entries.length === 0) return null;
	return (
		<section aria-labelledby="time-entries" className="flex flex-col gap-3">
			<h2 id="time-entries" className="text-heading">
				{m.taskline_time_latest()}
			</h2>
			<ul className="flex flex-col divide-y rounded-lg border">
				{time.entries.map((entry) => (
					<li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-body">
						<span className="w-16 shrink-0 font-medium tabular-nums">
							{entry.running ? m.taskline_time_running() : formatDuration(entry.minutes)}
						</span>
						<span className="text-muted-foreground">{entry.memberName}</span>
						<span className="min-w-0 flex-1 truncate">
							{entry.ref ? <span className="font-mono text-caption text-muted-foreground">{entry.ref}</span> : null}{" "}
							{entry.title ?? m.taskline_timesheet_no_task()}
						</span>
						{entry.billable ? <StatusBadge tone="info">{m.taskline_time_billable()}</StatusBadge> : null}
						<span className="text-caption text-muted-foreground">
							{formatDate(isoDateInstant(entry.onDay), { dateStyle: "medium" })}
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}
