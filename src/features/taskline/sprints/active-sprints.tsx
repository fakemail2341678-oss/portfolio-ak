import { Link } from "@tanstack/react-router";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { ProjectDot } from "../shell/taskline-sidebar";
import type { ActiveSprint } from "../types";
import { daysLeft, measureOf, SprintDates, SprintProgress } from "./sprint-bits";

/**
 * The active sprints of the projects someone may see (Task 52): on Home, and on the
 * admin's overview. Each links to its report in Taskline.
 */
export function ActiveSprintList({
	sprints,
	today,
	className,
}: {
	sprints: ReadonlyArray<ActiveSprint>;
	today: string;
	className?: string;
}) {
	return (
		<ul className={cn("flex flex-col gap-2", className)} data-testid="active-sprints">
			{sprints.map((sprint) => (
				<li key={sprint.id} className="flex flex-col gap-2 rounded-lg border bg-surface-1 p-3">
					<div className="flex items-start justify-between gap-2">
						<Link
							{...tasklineLinks.sprint(sprint.project.ws, sprint.project.key, sprint.id)}
							className="min-w-0 font-medium text-body underline-offset-4 hover:underline"
							data-testid="active-sprint-open"
						>
							{sprint.name}
						</Link>
						<span className="shrink-0 text-caption text-muted-foreground tabular-nums">
							{m.taskline_sprint_days_left_short({ days: formatNumber(daysLeft(sprint, today)) })}
						</span>
					</div>
					<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<span className="flex items-center gap-1.5 text-caption">
							<ProjectDot project={sprint.project} className="size-2 rounded-sm" />
							{sprint.project.name}
						</span>
						<SprintDates sprint={sprint} />
					</span>
					<SprintProgress totals={sprint.totals} measure={measureOf(sprint.estimation)} />
				</li>
			))}
		</ul>
	);
}
