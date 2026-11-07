import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { m } from "@/paraglide/messages";
import { PROJECT_HEALTH } from "../labels";
import { tasklineMutations } from "../queries";
import { PROJECT_HEALTHS, type ProjectHealth } from "../types";

const formSchema = z.object({
	health: z.enum(PROJECT_HEALTHS),
	body: z.string(),
});

/** "Post an update" (loaded on click): how the project is doing, which also sets its health, and what to say about it. */
export default function ProjectUpdateDialog({
	ws,
	projectKey,
	userId,
	health,
	onClose,
}: {
	ws: string;
	projectKey: string;
	userId: string;
	health: ProjectHealth | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const post = useMutation(tasklineMutations.postProjectUpdate(queryClient, userId));
	const form = useAppForm({
		...formOptions({
			defaultValues: { health: health ?? ("on_track" as ProjectHealth), body: "" },
			validators: formValidators(formSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				await post.mutateAsync({ ws, key: projectKey, health: value.health, body: value.body });
				formApi.reset(value);
				toast.success(m.taskline_update_posted());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.taskline_update_new()}
				description={m.taskline_update_new_description()}
				submitLabel={m.taskline_update_post()}
				onClose={onClose}
				data-testid="project-update-dialog"
			>
				<form.AppField name="health">
					{(field) => (
						<field.SelectField
							label={m.taskline_project_health()}
							options={PROJECT_HEALTHS.map((each) => ({ value: each, label: PROJECT_HEALTH[each].label() }))}
						/>
					)}
				</form.AppField>
				<form.AppField name="body">{(field) => <field.RichTextField label={m.taskline_update_body()} />}</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
