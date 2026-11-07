import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { FormSection } from "@/components/page/form-layout";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { keyBetweenNeighbours } from "@/lib/fractional-index";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { endPosition } from "../board/moves";
import { TASKLINE_COLOR_LABELS, tasklineColor } from "../colors";
import { CATEGORY_LABELS } from "../labels";
import { projectTasksQueryOptions, tasklineMutations } from "../queries";
import { STATUS_NAME_MAX } from "../schema";
import {
	STATUS_CATEGORIES,
	type StatusCategory,
	TASKLINE_COLORS,
	type TasklineColor,
	type TasklineStatus,
} from "../types";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/settings/workflow");

/**
 * Workflow: the project's statuses (the board's columns), in order. Each one's name
 * (saved on leaving the field), colour, category (what closing means) and WIP limit;
 * up and down to reorder; deleting one moves its tasks to another first.
 */
export function WorkflowSettings() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const update = useMutation(tasklineMutations.updateStatus(queryClient, userId));
	const create = useMutation(tasklineMutations.createStatus(queryClient, userId));
	const remove = useMutation(tasklineMutations.deleteStatus(queryClient, userId));
	const [deleting, setDeleting] = useState<TasklineStatus | null>(null);
	const formId = useId();
	const statuses = data.statuses;
	const fail = (error: Error) => toast.error(errorMessage(error));
	const change = (status: TasklineStatus, changes: Partial<Omit<TasklineStatus, "id">>) =>
		update.mutate({ ws, key, id: status.id, ...changes }, { onError: fail });

	const reorder = (index: number, direction: -1 | 1) => {
		const status = statuses[index];
		const others = statuses.filter((_, each) => each !== index);
		const to = index + direction;
		if (!status || to < 0 || to > others.length) return;
		change(status, { position: keyBetweenNeighbours(others[to - 1]?.position, others[to]?.position) });
	};

	const add = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = event.currentTarget;
		const values = new FormData(form);
		const name = String(values.get("name") ?? "").trim();
		if (!name) return;
		create.mutate(
			{
				ws,
				key,
				name,
				category: String(values.get("category") ?? "started") as StatusCategory,
				position: endPosition(statuses),
			},
			{ onSuccess: () => form.reset(), onError: fail },
		);
	};

	return (
		<FormSection title={m.taskline_settings_workflow()} description={m.taskline_settings_workflow_description()}>
			<ol className="flex flex-col divide-y rounded-md border" data-testid="workflow-statuses">
				{statuses.map((status, index) => {
					const count = data.tasks.filter((task) => task.statusId === status.id).length;
					return (
						<li key={status.id} className="flex flex-wrap items-center gap-2 px-3 py-2" data-testid="workflow-status">
							<span
								aria-hidden
								className="size-3 shrink-0 rounded-full"
								style={{ backgroundColor: tasklineColor(status.color) }}
							/>
							<Input
								defaultValue={status.name}
								key={status.name}
								maxLength={STATUS_NAME_MAX}
								aria-label={m.taskline_status_name_of({ position: formatNumber(index + 1) })}
								className="h-8 w-44"
								onBlur={(event) => {
									const name = event.target.value.trim();
									if (name && name !== status.name) change(status, { name });
								}}
							/>
							<NativeSelect
								value={status.category}
								aria-label={m.taskline_status_category_of({ status: status.name })}
								className="h-8 w-auto"
								onChange={(event) => change(status, { category: event.target.value as StatusCategory })}
							>
								{STATUS_CATEGORIES.map((category) => (
									<option key={category} value={category}>
										{CATEGORY_LABELS[category]()}
									</option>
								))}
							</NativeSelect>
							<NativeSelect
								value={status.color}
								aria-label={m.taskline_status_color_of({ status: status.name })}
								className="h-8 w-auto"
								onChange={(event) => change(status, { color: event.target.value as TasklineColor })}
							>
								{TASKLINE_COLORS.map((color) => (
									<option key={color} value={color}>
										{TASKLINE_COLOR_LABELS[color]()}
									</option>
								))}
							</NativeSelect>
							<Input
								type="number"
								min={1}
								max={999}
								defaultValue={status.wipLimit ?? ""}
								key={`wip:${status.wipLimit ?? ""}`}
								placeholder={m.taskline_wip_none()}
								aria-label={m.taskline_status_wip_of({ status: status.name })}
								className="h-8 w-28"
								onBlur={(event) => {
									const value = event.target.value === "" ? null : Number(event.target.value);
									if (value !== status.wipLimit && (value === null || (Number.isInteger(value) && value > 0))) {
										change(status, { wipLimit: value });
									}
								}}
							/>
							<span className="text-caption text-muted-foreground tabular-nums">
								{m.taskline_status_tasks({ count: formatNumber(count) })}
							</span>
							<span className="ms-auto flex gap-1">
								<Button variant="ghost" size="icon" disabled={index === 0} onClick={() => reorder(index, -1)}>
									<ArrowUpIcon aria-hidden />
									<span className="sr-only">{m.taskline_status_up({ status: status.name })}</span>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									disabled={index === statuses.length - 1}
									onClick={() => reorder(index, 1)}
								>
									<ArrowDownIcon aria-hidden />
									<span className="sr-only">{m.taskline_status_down({ status: status.name })}</span>
								</Button>
								<Button variant="ghost" size="icon" disabled={statuses.length <= 1} onClick={() => setDeleting(status)}>
									<Trash2Icon aria-hidden />
									<span className="sr-only">{m.taskline_status_delete({ status: status.name })}</span>
								</Button>
							</span>
						</li>
					);
				})}
			</ol>
			<form method="post" onSubmit={add} className="flex flex-wrap items-end gap-3" data-testid="add-status">
				<label htmlFor={`${formId}-name`} className="flex flex-col gap-1.5 text-body">
					<span className="font-medium">{m.taskline_status_new()}</span>
					<Input id={`${formId}-name`} name="name" maxLength={STATUS_NAME_MAX} autoComplete="off" className="w-56" />
				</label>
				<label htmlFor={`${formId}-category`} className="flex flex-col gap-1.5 text-body">
					<span className="font-medium">{m.taskline_status_category()}</span>
					<NativeSelect id={`${formId}-category`} name="category" defaultValue="started" className="w-40">
						{STATUS_CATEGORIES.map((category) => (
							<option key={category} value={category}>
								{CATEGORY_LABELS[category]()}
							</option>
						))}
					</NativeSelect>
				</label>
				<Button type="submit" variant="outline" disabled={create.isPending}>
					<PlusIcon aria-hidden />
					{m.taskline_status_add()}
				</Button>
			</form>
			{deleting ? (
				<DeleteStatusDialog
					status={deleting}
					statuses={statuses}
					count={data.tasks.filter((task) => task.statusId === deleting.id).length}
					onClose={() => setDeleting(null)}
					onDelete={async (moveTo) => {
						try {
							await remove.mutateAsync({ ws, key, id: deleting.id, moveTo });
							toast.success(m.taskline_status_deleted());
							setDeleting(null);
						} catch (error) {
							toast.error(errorMessage(error));
						}
					}}
				/>
			) : null}
		</FormSection>
	);
}

/** Deleting a status: its tasks (trashed ones too) move to the one picked here first. */
function DeleteStatusDialog({
	status,
	statuses,
	count,
	onClose,
	onDelete,
}: {
	status: TasklineStatus;
	statuses: ReadonlyArray<TasklineStatus>;
	count: number;
	onClose: () => void;
	onDelete: (moveTo: string | undefined) => Promise<void>;
}) {
	const others = statuses.filter((each) => each.id !== status.id);
	const [moveTo, setMoveTo] = useState(others[0]?.id ?? "");
	const [busy, setBusy] = useState(false);
	const selectId = useId();
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent data-testid="delete-status-dialog">
				<DialogHeader>
					<DialogTitle>{m.taskline_status_delete({ status: status.name })}</DialogTitle>
					<DialogDescription>{m.taskline_status_delete_body({ count: formatNumber(count) })}</DialogDescription>
				</DialogHeader>
				<label htmlFor={selectId} className="flex flex-col gap-1.5 text-body">
					<span className="font-medium">{m.taskline_status_move_to()}</span>
					<NativeSelect id={selectId} value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
						{others.map((each) => (
							<option key={each.id} value={each.id}>
								{each.name}
							</option>
						))}
					</NativeSelect>
				</label>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						{m.common_cancel()}
					</Button>
					<Button
						variant="destructive"
						disabled={busy}
						onClick={async () => {
							setBusy(true);
							try {
								await onDelete(moveTo || undefined);
							} finally {
								setBusy(false);
							}
						}}
					>
						{m.crud_delete()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
