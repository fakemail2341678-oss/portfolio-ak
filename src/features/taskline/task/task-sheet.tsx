import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { m } from "@/paraglide/messages";
import { projectTasksQueryOptions, taskQueryOptions } from "../queries";
import { TaskPanel } from "./task-panel";

/**
 * The task over a view (`?task=WEB-12`, a masked route: the address bar shows the
 * task's page). Loaded when it opens, with placeholder lines meanwhile; the project's
 * statuses, members and labels are the view's, already loaded. Closing goes back.
 */
export default function TaskSheet({
	userId,
	ws,
	projectKey,
	taskRef,
	onClose,
}: {
	userId: string;
	ws: string;
	projectKey: string;
	taskRef: string;
	onClose: () => void;
}) {
	const { data: project } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, projectKey));
	const { data: task, error } = useQuery(taskQueryOptions(userId, ws, taskRef));
	return (
		<Sheet open onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-3xl" data-testid="task-sheet">
				<SheetHeader>
					<SheetTitle className="pe-8 text-heading wrap-anywhere">{task?.title ?? taskRef}</SheetTitle>
					<SheetDescription>{m.taskline_task_sheet_description({ project: project.project.name })}</SheetDescription>
				</SheetHeader>
				<div className="px-4 pb-6">
					{task ? (
						<TaskPanel task={task} project={project} userId={userId} ws={ws} variant="sheet" onTrashed={onClose} />
					) : error ? (
						<div className="flex flex-col items-start gap-3">
							<p className="text-destructive text-sm" role="alert">
								{errorMessage(error)}
							</p>
							<Button variant="outline" onClick={onClose}>
								{m.dialog_close()}
							</Button>
						</div>
					) : (
						<output className="flex flex-col gap-4" aria-busy="true">
							<span className="sr-only">{m.taskline_task_loading()}</span>
							{Array.from({ length: 5 }, (_, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows have no identity.
								<span key={index} className="block h-9 w-full animate-pulse rounded-md bg-muted" />
							))}
						</output>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
