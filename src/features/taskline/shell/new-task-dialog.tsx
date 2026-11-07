import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { tasklineMutations } from "../queries";
import { TASK_TITLE_MAX } from "../schema";
import type { NavProject } from "../types";

const newTaskSchema = z.object({ project: z.string().min(1), title: required({ max: TASK_TITLE_MAX }) });

/** A project's value in the picker: its workspace and key ("team/WEB"), as two workspaces may both have a WEB. */
const projectValue = (project: Pick<NavProject, "ws" | "key">) => `${project.ws}/${project.key}`;

/**
 * "New task" from the sidebar: a title in one of the caller's projects (the current
 * one first), then its page. The server decides whether they may add tasks there.
 */
export default function NewTaskDialog({
	userId,
	projects,
	current,
	onClose,
}: {
	userId: string;
	projects: ReadonlyArray<NavProject>;
	current: Pick<NavProject, "ws" | "key"> | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const create = useMutation(tasklineMutations.createTask(queryClient, userId));
	const several = new Set(projects.map((project) => project.ws)).size > 1;
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				project:
					current && projects.some((project) => projectValue(project) === projectValue(current))
						? projectValue(current)
						: projectValue(projects[0] ?? { ws: "", key: "" }),
				title: "",
			},
			validators: formValidators(newTaskSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			const [ws = "", key = ""] = value.project.split("/");
			try {
				const task = await create.mutateAsync({ ws, key, title: value.title.trim() });
				toast.success(m.taskline_task_created({ task: task.ref }));
				onClose();
				await navigate(tasklineLinks.task(ws, task.ref));
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.taskline_new_task()}
				description={m.taskline_new_task_description()}
				submitLabel={m.taskline_create_task()}
				onClose={onClose}
				data-testid="new-task-dialog"
			>
				<form.AppField name="project">
					{(field) => (
						<field.SelectField
							label={m.taskline_field_project()}
							options={projects.map((project) => ({
								value: projectValue(project),
								label: several
									? `${project.name} (${project.key}, ${project.workspaceKind === "sandbox" ? m.taskline_crumb_sandbox() : m.taskline_crumb_team()})`
									: `${project.name} (${project.key})`,
							}))}
						/>
					)}
				</form.AppField>
				<form.AppField name="title">
					{(field) => (
						<field.TextField label={m.taskline_field_title()} maxLength={TASK_TITLE_MAX} autoComplete="off" />
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
