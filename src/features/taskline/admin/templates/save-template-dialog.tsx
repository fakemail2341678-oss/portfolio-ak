import { formOptions } from "@tanstack/react-form";
import { toast } from "sonner";
import { z } from "zod";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { formatNumber } from "@/lib/i18n/intl";
import { optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { TEMPLATE_DESCRIPTION_MAX, TEMPLATE_NAME_MAX } from "../../template-definition";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { tasklineAdminMutations } from "../queries";

const formSchema = z.object({
	name: required({ max: TEMPLATE_NAME_MAX }),
	description: optionalText({ max: TEMPLATE_DESCRIPTION_MAX }),
	tasks: z.boolean(),
});

/** "Save as template" (loaded on click): a new template from this project, its tasks too if asked. */
export default function SaveTemplateDialog({
	projectId,
	projectName,
	onClose,
}: {
	projectId: string;
	projectName: string;
	onClose: () => void;
}) {
	const save = useCrudMutation(tasklineAdminMutations.saveProjectAsTemplate(), { invalidate: ALL_TASKLINE_ADMIN });
	const form = useAppForm({
		...formOptions({
			defaultValues: { name: projectName, description: "", tasks: false },
			validators: formValidators(formSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const saved = await save.mutateAsync({
					projectId,
					name: value.name.trim(),
					description: value.description.trim(),
					tasks: value.tasks,
				});
				formApi.reset(value);
				toast.success(
					saved.leftOut > 0
						? m.taskline_template_saved_left_out({ name: saved.name, count: formatNumber(saved.leftOut) })
						: m.taskline_template_saved({ name: saved.name }),
				);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.taskline_template_save()}
				description={m.taskline_template_save_description()}
				submitLabel={m.crud_save()}
				onClose={onClose}
				data-testid="save-template-dialog"
			>
				<form.AppField name="name">
					{(field) => (
						<field.TextField label={m.taskline_template_name()} maxLength={TEMPLATE_NAME_MAX} autoComplete="off" />
					)}
				</form.AppField>
				<form.AppField name="description">
					{(field) => (
						<field.TextareaField
							label={m.taskline_template_description()}
							maxLength={TEMPLATE_DESCRIPTION_MAX}
							optional
						/>
					)}
				</form.AppField>
				<form.AppField name="tasks">
					{(field) => (
						<field.CheckboxField
							label={m.taskline_template_save_tasks()}
							description={m.taskline_template_save_tasks_hint()}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
