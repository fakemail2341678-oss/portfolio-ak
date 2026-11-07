import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RepeatIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { tasklineKeys, tasklineMutations } from "../queries";
import type { RecurrenceRule } from "../recurrence";
import type { TaskDetail } from "../types";
import { recurrenceText } from "./recurrence-text";

const RecurrenceDialog = lazy(() => import("./recurrence-dialog"));

/**
 * The task's repeat (Task 56): how it repeats, or that it doesn't; editors set it (a
 * dialog, loaded when opened) or stop it. Saved at once; the server stores the rule
 * from the task's due day, so the page shows what it saved, not a guess.
 */
export function RepeatField({
	task,
	userId,
	ws,
	editable,
}: {
	task: TaskDetail;
	userId: string;
	ws: string;
	editable: boolean;
}) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const patch = useMutation(tasklineMutations.patchTask(queryClient, userId));
	const save = async (recurrence: RecurrenceRule | null) => {
		const saved = await patch.mutateAsync({ ws, ref: task.ref, recurrence });
		queryClient.setQueryData(tasklineKeys.task(userId, ws, task.ref), saved);
	};
	return (
		<div className="flex flex-col gap-1.5" data-testid="task-repeat">
			<span className="text-caption font-medium text-muted-foreground">{m.taskline_field_repeat()}</span>
			<span className="flex items-start gap-1.5 text-body">
				<RepeatIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
				{task.recurrence ? (
					recurrenceText(task.recurrence)
				) : (
					<span className="text-muted-foreground">{m.taskline_repeat_none()}</span>
				)}
			</span>
			{editable ? (
				<span className="flex flex-wrap gap-1">
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2"
						onClick={() => setOpen(true)}
						data-testid="task-repeat-edit"
					>
						{task.recurrence ? m.taskline_repeat_change() : m.taskline_repeat_set()}
					</Button>
					{task.recurrence ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2"
							disabled={patch.isPending}
							onClick={() =>
								void save(null).then(
									() => toast.success(m.taskline_repeat_stopped()),
									(error) => toast.error(errorMessage(error)),
								)
							}
							data-testid="task-repeat-stop"
						>
							{m.taskline_repeat_stop()}
						</Button>
					) : null}
				</span>
			) : null}
			<Suspense fallback={null}>
				{open ? (
					<RecurrenceDialog
						recurrence={task.recurrence}
						dueOn={task.dueOn}
						onClose={() => setOpen(false)}
						onSave={async (rule) => {
							await save(rule);
							toast.success(m.crud_toast_saved());
						}}
					/>
				) : null}
			</Suspense>
		</div>
	);
}
