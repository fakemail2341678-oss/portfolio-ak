import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { useProjectFreshness } from "../freshness";
import { tasklineLinks } from "../links";
import { projectTasksQueryOptions, taskQueryOptions } from "../queries";
import { parseTaskRef } from "../schema";
import { TaskTypeIcon } from "./task-bits";
import { TaskPanel } from "./task-panel";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/t/$ref");

/**
 * /app/taskline/$ws/t/$ref: a task's own page (what a copied link, a reload of the
 * sheet, a new tab or no JavaScript opens). The same panel as the sheet, full width.
 */
export function TaskPage() {
	const { session } = route.useRouteContext();
	const { ws, ref } = route.useParams();
	const userId = session.user.id;
	const key = parseTaskRef(ref)?.key ?? "";
	const navigate = useNavigate();
	const { data: project } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const { data: task } = useSuspenseQuery(taskQueryOptions(userId, ws, ref));
	useProjectFreshness(userId, ws, key, project.project.rev);
	return (
		<Page width="wide" data-testid="task-page">
			<Button asChild variant="ghost" size="sm" className="-ms-2 w-fit">
				<Link {...tasklineLinks.board(ws, key)}>
					<ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
					{m.taskline_back_to_board({ project: project.project.name })}
				</Link>
			</Button>
			<PageHeader
				title={
					<span className="flex items-start gap-2 wrap-anywhere">
						<TaskTypeIcon type={task.type} className="mt-2" />
						{task.title}
					</span>
				}
			/>
			<TaskPanel
				task={task}
				project={project}
				userId={userId}
				ws={ws}
				variant="page"
				onTrashed={() => void navigate(tasklineLinks.board(ws, key))}
			/>
		</Page>
	);
}
