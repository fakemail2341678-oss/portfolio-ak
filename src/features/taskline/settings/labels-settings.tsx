import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useId } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { FormSection } from "@/components/page/form-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { m } from "@/paraglide/messages";
import { TASKLINE_COLOR_LABELS, tasklineColor } from "../colors";
import { projectTasksQueryOptions, tasklineMutations } from "../queries";
import { LABEL_NAME_MAX } from "../schema";
import { TASKLINE_COLORS, type TasklineColor, type TasklineLabel } from "../types";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/settings/labels");

/**
 * Labels: the project's own (renamed on leaving the field, recoloured, deleted) and,
 * read-only here, the workspace's (the admin's, Task 49).
 */
export function LabelsSettings() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const formId = useId();
	const { data } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const create = useMutation(tasklineMutations.createLabel(queryClient, userId));
	const update = useMutation(tasklineMutations.updateLabel(queryClient, userId));
	const remove = useMutation(tasklineMutations.deleteLabel(queryClient, userId));
	const fail = (error: Error) => toast.error(errorMessage(error));
	const own = data.labels.filter((label) => label.projectId !== null);
	const shared = data.labels.filter((label) => label.projectId === null);
	const change = (label: TasklineLabel, changes: { name?: string; color?: TasklineColor }) =>
		update.mutate({ ws, key, id: label.id, ...changes }, { onError: fail });

	const add = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = event.currentTarget;
		const values = new FormData(form);
		const name = String(values.get("name") ?? "").trim();
		if (!name) return;
		create.mutate(
			{ ws, key, name, color: String(values.get("color") ?? "gray") as TasklineColor },
			{ onSuccess: () => form.reset(), onError: fail },
		);
	};

	const removeLabel = async (label: TasklineLabel) => {
		const used = data.tasks.filter((task) => task.labelIds.includes(label.id)).length;
		const confirmed = await confirm({
			title: m.crud_delete_title({ label: label.name }),
			description: used > 0 ? m.taskline_label_delete_body({ count: String(used) }) : m.crud_delete_body(),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (confirmed) remove.mutate({ ws, key, id: label.id }, { onError: fail });
	};

	return (
		<FormSection title={m.taskline_settings_labels()} description={m.taskline_settings_labels_description()}>
			{own.length > 0 ? (
				<ul className="flex flex-col divide-y rounded-md border" data-testid="project-labels">
					{own.map((label) => (
						<li key={label.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
							<span
								aria-hidden
								className="size-3 shrink-0 rounded-full"
								style={{ backgroundColor: tasklineColor(label.color) }}
							/>
							<Input
								defaultValue={label.name}
								key={label.name}
								maxLength={LABEL_NAME_MAX}
								aria-label={m.taskline_label_name_of({ label: label.name })}
								className="h-8 w-48"
								onBlur={(event) => {
									const name = event.target.value.trim();
									if (name && name !== label.name) change(label, { name });
								}}
							/>
							<NativeSelect
								value={label.color}
								aria-label={m.taskline_label_color_of({ label: label.name })}
								className="h-8 w-auto"
								onChange={(event) => change(label, { color: event.target.value as TasklineColor })}
							>
								{TASKLINE_COLORS.map((color) => (
									<option key={color} value={color}>
										{TASKLINE_COLOR_LABELS[color]()}
									</option>
								))}
							</NativeSelect>
							<Button variant="ghost" size="icon" className="ms-auto" onClick={() => void removeLabel(label)}>
								<Trash2Icon aria-hidden />
								<span className="sr-only">{m.crud_delete_title({ label: label.name })}</span>
							</Button>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground text-sm">{m.taskline_labels_empty()}</p>
			)}
			<form method="post" onSubmit={add} className="flex flex-wrap items-end gap-3" data-testid="add-label">
				<label htmlFor={`${formId}-name`} className="flex flex-col gap-1.5 text-body">
					<span className="font-medium">{m.taskline_label_new()}</span>
					<Input id={`${formId}-name`} name="name" maxLength={LABEL_NAME_MAX} autoComplete="off" className="w-56" />
				</label>
				<label htmlFor={`${formId}-color`} className="flex flex-col gap-1.5 text-body">
					<span className="font-medium">{m.taskline_project_color()}</span>
					<NativeSelect id={`${formId}-color`} name="color" defaultValue="gray" className="w-36">
						{TASKLINE_COLORS.map((color) => (
							<option key={color} value={color}>
								{TASKLINE_COLOR_LABELS[color]()}
							</option>
						))}
					</NativeSelect>
				</label>
				<Button type="submit" variant="outline" disabled={create.isPending}>
					<PlusIcon aria-hidden />
					{m.taskline_label_add()}
				</Button>
			</form>
			{shared.length > 0 ? (
				<div className="flex flex-col gap-2 border-t pt-4">
					<h3 className="font-medium text-body">{m.taskline_labels_workspace()}</h3>
					<p className="text-muted-foreground text-sm">{m.taskline_labels_workspace_note()}</p>
					<ul className="flex flex-wrap gap-2">
						{shared.map((label) => (
							<li key={label.id} className="inline-flex items-center gap-1.5 rounded-full border px-2 text-caption">
								<span
									aria-hidden
									className="size-2 rounded-full"
									style={{ backgroundColor: tasklineColor(label.color) }}
								/>
								{label.name}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</FormSection>
	);
}
