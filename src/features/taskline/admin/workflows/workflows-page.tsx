import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { useConfirm } from "@/components/dialogs/confirm";
import { FormSection } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { TASKLINE_COLOR_LABELS, tasklineColor } from "../../colors";
import { CATEGORY_LABELS, TYPE_LABELS } from "../../labels";
import { LABEL_NAME_MAX, STATUS_NAME_MAX } from "../../schema";
import { DEFAULT_STATUS_MAX } from "../../settings";
import {
	STATUS_CATEGORIES,
	type StatusCategory,
	TASK_TYPES,
	TASKLINE_COLORS,
	type TasklineColor,
	type TaskType,
} from "../../types";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { adminWorkflowsQueryOptions, tasklineAdminMutations } from "../queries";
import type { AdminWorkflows, DefaultStatus } from "../schema";

function ColorSelect({
	value,
	onChange,
	label,
}: {
	value: TasklineColor;
	onChange: (color: TasklineColor) => void;
	label: string;
}) {
	return (
		<span className="flex items-center gap-2">
			<span className="size-3 shrink-0 rounded-full" style={{ background: tasklineColor(value) }} aria-hidden />
			<NativeSelect
				aria-label={label}
				value={value}
				onChange={(event) => onChange(event.target.value as TasklineColor)}
			>
				{TASKLINE_COLORS.map((color) => (
					<option key={color} value={color}>
						{TASKLINE_COLOR_LABELS[color]()}
					</option>
				))}
			</NativeSelect>
		</span>
	);
}

/** The statuses a new project starts with and the task types offered: one versioned save. */
function DefaultsForm({ workflows }: { workflows: AdminWorkflows }) {
	const [statuses, setStatuses] = useState<DefaultStatus[]>(workflows.statuses);
	const [custom, setCustom] = useState(workflows.custom);
	const [types, setTypes] = useState<TaskType[]>(workflows.taskTypes);
	const save = useCrudMutation(tasklineAdminMutations.updateWorkflows(), { invalidate: ALL_TASKLINE_ADMIN });
	const edit = (index: number, change: Partial<DefaultStatus>) => {
		setCustom(true);
		setStatuses(statuses.map((status, each) => (each === index ? { ...status, ...change } : status)));
	};
	const move = (index: number, by: -1 | 1) => {
		const next = [...statuses];
		const [moved] = next.splice(index, 1);
		if (!moved) return;
		next.splice(index + by, 0, moved);
		setCustom(true);
		setStatuses(next);
	};
	const submit = (event: FormEvent) => {
		event.preventDefault();
		save.mutate(
			{
				updatedAt: workflows.updatedAt,
				statuses: custom ? statuses.map((status) => ({ ...status, name: status.name.trim() })) : null,
				taskTypes: TASK_TYPES.filter((type) => types.includes(type)),
			},
			{ onSuccess: () => toast.success(m.crud_toast_saved()) },
		);
	};
	return (
		<form method="post" onSubmit={submit} className="flex flex-col gap-8" data-testid="taskline-workflows-form">
			<FormSection title={m.taskline_admin_default_statuses()} description={m.taskline_admin_default_statuses_hint()}>
				<ol className="flex flex-col gap-2">
					{statuses.map((status, index) => (
						// Rows are edited in place and reordered; the index is their identity until saved.
						// biome-ignore lint/suspicious/noArrayIndexKey: unsaved rows have no id
						<li key={index} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
							<Input
								aria-label={m.taskline_admin_status_name({ position: formatNumber(index + 1) })}
								value={status.name}
								maxLength={STATUS_NAME_MAX}
								required
								className="w-48"
								onChange={(event) => edit(index, { name: event.target.value })}
							/>
							<NativeSelect
								aria-label={m.taskline_status_category()}
								value={status.category}
								onChange={(event) => edit(index, { category: event.target.value as StatusCategory })}
							>
								{STATUS_CATEGORIES.map((category) => (
									<option key={category} value={category}>
										{CATEGORY_LABELS[category]()}
									</option>
								))}
							</NativeSelect>
							<ColorSelect
								label={m.taskline_project_color()}
								value={status.color}
								onChange={(color) => edit(index, { color })}
							/>
							<span className="ms-auto flex gap-1">
								<Button
									type="button"
									size="icon"
									variant="ghost"
									disabled={index === 0}
									aria-label={m.taskline_status_up({ status: status.name })}
									onClick={() => move(index, -1)}
								>
									<ArrowUpIcon aria-hidden />
								</Button>
								<Button
									type="button"
									size="icon"
									variant="ghost"
									disabled={index === statuses.length - 1}
									aria-label={m.taskline_status_down({ status: status.name })}
									onClick={() => move(index, 1)}
								>
									<ArrowDownIcon aria-hidden />
								</Button>
								<Button
									type="button"
									size="icon"
									variant="ghost"
									disabled={statuses.length <= 2}
									aria-label={m.taskline_status_delete({ status: status.name })}
									onClick={() => {
										setCustom(true);
										setStatuses(statuses.filter((_, each) => each !== index));
									}}
								>
									<Trash2Icon aria-hidden />
								</Button>
							</span>
						</li>
					))}
				</ol>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={statuses.length >= DEFAULT_STATUS_MAX}
						onClick={() => {
							setCustom(true);
							setStatuses([...statuses, { name: m.taskline_status_new(), category: "started", color: "gray" }]);
						}}
					>
						<PlusIcon aria-hidden />
						{m.taskline_status_add()}
					</Button>
					{custom ? (
						<Button type="button" variant="ghost" onClick={() => setCustom(false)}>
							<RotateCcwIcon aria-hidden />
							{m.taskline_admin_built_in_statuses()}
						</Button>
					) : (
						<p className="self-center text-caption text-muted-foreground">{m.taskline_admin_built_in_note()}</p>
					)}
				</div>
			</FormSection>
			<FormSection title={m.taskline_admin_task_types()} description={m.taskline_admin_task_types_hint()}>
				<fieldset className="flex flex-wrap gap-4">
					<legend className="sr-only">{m.taskline_admin_task_types()}</legend>
					{TASK_TYPES.map((type) => (
						<Label key={type} className="flex items-center gap-2 font-normal">
							<Checkbox
								checked={types.includes(type)}
								onCheckedChange={(checked) =>
									setTypes(checked ? [...types, type] : types.filter((each) => each !== type))
								}
							/>
							{TYPE_LABELS[type]()}
						</Label>
					))}
				</fieldset>
			</FormSection>
			<div>
				<Button type="submit" disabled={save.isPending || types.length === 0} data-testid="workflows-save">
					{m.crud_save()}
				</Button>
			</div>
		</form>
	);
}

/** Labels every team project shares (`project_id` null). */
function WorkspaceLabels({ labels }: { labels: AdminWorkflows["labels"] }) {
	const id = useId();
	const confirm = useConfirm();
	const [name, setName] = useState("");
	const [color, setColor] = useState<TasklineColor>("blue");
	const create = useCrudMutation(tasklineAdminMutations.createLabel(), { invalidate: ALL_TASKLINE_ADMIN });
	const update = useCrudMutation(tasklineAdminMutations.updateLabel(), { invalidate: ALL_TASKLINE_ADMIN });
	const remove = useCrudMutation(tasklineAdminMutations.deleteLabel(), { invalidate: ALL_TASKLINE_ADMIN });
	return (
		<FormSection title={m.taskline_admin_workspace_labels()} description={m.taskline_admin_workspace_labels_hint()}>
			{labels.length === 0 ? (
				<p className="text-muted-foreground">{m.taskline_admin_labels_empty()}</p>
			) : (
				<ul className="flex flex-col gap-2" data-testid="workspace-labels">
					{labels.map((label) => (
						<li key={label.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
							<Input
								aria-label={m.taskline_admin_label_name_of({ name: label.name })}
								defaultValue={label.name}
								maxLength={LABEL_NAME_MAX}
								className="w-48"
								onBlur={(event) => {
									const next = event.target.value.trim();
									if (next && next !== label.name) update.mutate({ id: label.id, name: next, color: label.color });
								}}
							/>
							<ColorSelect
								label={m.taskline_project_color()}
								value={label.color}
								onChange={(next) => update.mutate({ id: label.id, name: label.name, color: next })}
							/>
							<span className="text-caption text-muted-foreground">
								{m.taskline_admin_label_tasks({ count: formatNumber(label.tasks) })}
							</span>
							<Button
								type="button"
								size="icon"
								variant="ghost"
								className="ms-auto"
								aria-label={m.taskline_admin_label_delete({ name: label.name })}
								onClick={async () => {
									const confirmed = await confirm({
										title: m.taskline_admin_label_delete({ name: label.name }),
										description: m.taskline_admin_label_delete_body({ count: formatNumber(label.tasks) }),
										confirmLabel: m.crud_delete(),
										destructive: true,
									});
									if (confirmed) remove.mutate({ id: label.id });
								}}
							>
								<Trash2Icon aria-hidden />
							</Button>
						</li>
					))}
				</ul>
			)}
			<form
				method="post"
				className="flex flex-wrap items-end gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					if (!name.trim()) return;
					create.mutate(
						{ name: name.trim(), color },
						{
							onSuccess: () => {
								setName("");
								toast.success(m.crud_toast_created());
							},
						},
					);
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor={`${id}-name`}>{m.taskline_admin_new_label()}</Label>
					<Input
						id={`${id}-name`}
						value={name}
						maxLength={LABEL_NAME_MAX}
						className="w-48"
						onChange={(event) => setName(event.target.value)}
						data-testid="workspace-label-name"
					/>
				</div>
				<ColorSelect label={m.taskline_project_color()} value={color} onChange={setColor} />
				<Button type="submit" variant="outline" disabled={!name.trim() || create.isPending}>
					<PlusIcon aria-hidden />
					{m.taskline_admin_add_label()}
				</Button>
			</form>
		</FormSection>
	);
}

/**
 * /admin/taskline/workflows: how new team projects start (their statuses, in order), the
 * task types the team uses, and the labels every project shares. A project's own
 * workflow is its lead's, in Taskline.
 */
export function TasklineWorkflowsPage() {
	const { data: workflows } = useSuspenseQuery(adminWorkflowsQueryOptions());
	return (
		<Page width="admin" data-testid="taskline-admin-workflows">
			<PageHeader title={m.taskline_admin_workflows_title()} description={m.taskline_admin_workflows_description()} />
			<DefaultsForm key={workflows.updatedAt} workflows={workflows} />
			<WorkspaceLabels labels={workflows.labels} />
		</Page>
	);
}
