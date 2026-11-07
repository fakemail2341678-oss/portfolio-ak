import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/data-display/relative-time";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { EmptyState } from "@/components/page/empty-state";
import { FormSection } from "@/components/page/form-layout";
import { Button } from "@/components/ui/button";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { m } from "@/paraglide/messages";
import { projectTasksQueryOptions, projectTrashQueryOptions, tasklineMutations } from "../queries";
import type { TrashedTask } from "../types";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/settings/trash");

/** The trash: what was trashed, newest first; restore it (with its subtasks) or delete it for good. */
export function TrashSettings() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { data: project } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const { data: trash } = useSuspenseQuery(projectTrashQueryOptions(userId, ws, key));
	const now = useMinuteClock(Date.parse(project.readAt));
	const restore = useMutation(tasklineMutations.restoreTask(queryClient, userId));
	const purge = useMutation(tasklineMutations.purgeTask(queryClient, userId));
	const fail = (error: Error) => toast.error(errorMessage(error));

	const purgeTask = async (task: TrashedTask) => {
		const confirmed = await confirm({
			title: m.taskline_purge_title({ task: task.ref }),
			description: m.taskline_purge_body(),
			confirmLabel: m.taskline_purge(),
			destructive: true,
		});
		if (!confirmed) return;
		purge.mutate(
			{ ws, ref: task.ref },
			{ onSuccess: () => toast.success(m.taskline_purged({ task: task.ref })), onError: fail },
		);
	};

	return (
		<FormSection title={m.taskline_settings_trash()} description={m.taskline_settings_trash_description()}>
			{trash.length === 0 ? (
				<EmptyState icon={Trash2Icon} description={m.taskline_trash_empty()} />
			) : (
				<ul className="flex flex-col divide-y rounded-md border" data-testid="project-trash">
					{trash.map((task) => (
						<li key={task.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-body">
							<span className="font-mono text-caption text-muted-foreground">{task.ref}</span>
							<span className="min-w-0 flex-1 truncate">{task.title}</span>
							<span className="text-caption text-muted-foreground">
								<RelativeTime value={task.deletedAt} now={now} />
							</span>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									restore.mutate(
										{ ws, ref: task.ref },
										{ onSuccess: () => toast.success(m.taskline_restored({ task: task.ref })), onError: fail },
									)
								}
							>
								<RotateCcwIcon aria-hidden />
								{m.taskline_restore()}
							</Button>
							<Button variant="ghost" size="sm" className="text-danger" onClick={() => void purgeTask(task)}>
								<Trash2Icon aria-hidden />
								{m.taskline_purge()}
							</Button>
						</li>
					))}
				</ul>
			)}
		</FormSection>
	);
}
