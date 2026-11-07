import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { HistoryIcon, UsersIcon } from "lucide-react";
import { Timeline } from "@/components/data-display/activity-feed";
import { UserAvatar } from "@/components/data-display/user-avatar";
import { EmptyState } from "@/components/page/empty-state";
import { RichTextContent } from "@/components/rich-text-content";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { formatNumber } from "@/lib/i18n/intl";
import type { SafeHtml } from "@/lib/safe-html";
import { m } from "@/paraglide/messages";
import { tasklineColor } from "../colors";
import { CATEGORY_LABELS, PROJECT_ROLE_LABELS } from "../labels";
import { tasklineLinks } from "../links";
import { projectActivityQueryOptions, projectMembersQueryOptions, projectTasksQueryOptions } from "../queries";
import { activityItems } from "../task/activity";
import { STATUS_CATEGORIES } from "../types";
import { ProjectUpdates } from "./project-updates";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/");

/** The category's bar colour: the colour of its first status, so the bar reads like the board. */
const CATEGORY_TONE = {
	backlog: "gray",
	unstarted: "blue",
	started: "amber",
	completed: "green",
	canceled: "red",
} as const;

/**
 * A project's overview: what it is, how its lead says it's doing (its updates, Task 57),
 * how far along it is (by status category, then per status), who is on it, and what
 * happened lately (its activity feed).
 */
export function ProjectOverview() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const userId = session.user.id;
	const { data } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const { data: people } = useSuspenseQuery(projectMembersQueryOptions(userId, ws, key));
	const { data: activity } = useSuspenseQuery(projectActivityQueryOptions(userId, ws, key));
	const now = useMinuteClock(Date.parse(data.readAt));
	const { project, statuses, tasks } = data;
	const total = tasks.length;
	const closed = tasks.filter((task) => task.completedAt !== null).length;
	const categoryOf = new Map(statuses.map((status) => [status.id, status.category]));
	const byCategory = STATUS_CATEGORIES.map((category) => ({
		category,
		count: tasks.filter((task) => categoryOf.get(task.statusId) === category).length,
	}));
	const counts = statuses.map((status) => ({
		status,
		count: tasks.filter((task) => task.statusId === status.id).length,
	}));
	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]" data-testid="project-overview">
			<div className="flex min-w-0 flex-col gap-6">
				<section aria-labelledby="project-about" className="flex flex-col gap-2">
					<h2 id="project-about" className="text-heading">
						{m.taskline_project_about()}
					</h2>
					{project.description ? (
						// Sanitized when saved (rules.ts, richText), like every rich text the server returns.
						<RichTextContent html={project.description as SafeHtml} />
					) : (
						<p className="text-muted-foreground">{m.taskline_project_no_description()}</p>
					)}
				</section>
				<ProjectUpdates userId={userId} ws={ws} project={project} now={now} />
				<section aria-labelledby="project-progress" className="flex flex-col gap-3">
					<h2 id="project-progress" className="text-heading">
						{m.taskline_project_progress()}
					</h2>
					<p className="text-muted-foreground text-sm">
						{m.taskline_project_progress_summary({ closed: formatNumber(closed), total: formatNumber(total) })}
					</p>
					{total > 0 ? (
						<div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
							{byCategory
								.filter(({ count }) => count > 0)
								.map(({ category, count }) => (
									<span
										key={category}
										style={{
											width: `${(count / total) * 100}%`,
											backgroundColor: tasklineColor(CATEGORY_TONE[category]),
										}}
									/>
								))}
						</div>
					) : null}
					<dl className="flex flex-wrap gap-x-5 gap-y-1 text-caption" data-testid="project-categories">
						{byCategory.map(({ category, count }) => (
							<div key={category} className="flex items-center gap-1.5">
								<span
									aria-hidden
									className="size-2 rounded-full"
									style={{ backgroundColor: tasklineColor(CATEGORY_TONE[category]) }}
								/>
								<dt className="text-muted-foreground">{CATEGORY_LABELS[category]()}</dt>
								<dd className="tabular-nums">{formatNumber(count)}</dd>
							</div>
						))}
					</dl>
					<ul className="grid gap-2 sm:grid-cols-2" data-testid="project-statuses">
						{counts.map(({ status, count }) => (
							<li
								key={status.id}
								className="flex items-center gap-2 rounded-md border bg-surface-1 px-3 py-2 text-body"
							>
								<span
									aria-hidden
									className="size-2.5 rounded-full"
									style={{ backgroundColor: tasklineColor(status.color) }}
								/>
								<span className="min-w-0 flex-1 truncate">{status.name}</span>
								<span className="text-muted-foreground tabular-nums">{formatNumber(count)}</span>
							</li>
						))}
					</ul>
				</section>
				<section aria-labelledby="project-activity" className="flex flex-col gap-3" data-testid="project-activity">
					<h2 id="project-activity" className="flex items-center gap-2 text-heading">
						<HistoryIcon className="size-4 text-muted-foreground" aria-hidden />
						{m.taskline_project_activity()}
					</h2>
					{activity.length === 0 ? (
						<EmptyState icon={HistoryIcon} description={m.taskline_project_activity_empty()} />
					) : (
						<Timeline
							now={now}
							items={activityItems(activity, data, (entry) => {
								const task = activity.find((each) => each.id === entry.id)?.task;
								return task ? (
									<Link {...tasklineLinks.task(ws, task.ref)} className="hover:underline">
										<span className="font-mono text-muted-foreground">{task.ref}</span> {task.title}
									</Link>
								) : null;
							})}
						/>
					)}
				</section>
			</div>
			<section aria-labelledby="project-people" className="flex flex-col gap-3">
				<h2 id="project-people" className="flex items-center gap-2 text-heading">
					<UsersIcon className="size-4 text-muted-foreground" aria-hidden />
					{m.taskline_project_people()}
				</h2>
				<ul className="flex flex-col gap-2">
					{people.map((member) => (
						<li key={member.memberId} className="flex items-center gap-2 text-body">
							<UserAvatar name={member.name} size="sm" />
							<span className="min-w-0 flex-1 truncate">{member.name}</span>
							<span className="text-caption text-muted-foreground">{PROJECT_ROLE_LABELS[member.role]()}</span>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
