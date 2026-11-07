import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { isoDate, optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { tasklineMutations } from "../queries";
import { MILESTONE_DESCRIPTION_MAX, MILESTONE_NAME_MAX } from "../schema";
import type { Milestone } from "../types";

/** A milestone's name, day and description (loaded when opened, 0168); the server checks them again. */

const milestoneFormSchema = z.object({
	name: required({ max: MILESTONE_NAME_MAX }),
	dueOn: z.union([z.literal(""), isoDate()]),
	description: optionalText({ max: MILESTONE_DESCRIPTION_MAX }),
});

export default function MilestoneFormDialog({
	userId,
	ws,
	projectKey,
	milestone,
	onClose,
}: {
	userId: string;
	ws: string;
	projectKey: string;
	/** The milestone to edit; none: a new one. */
	milestone: Milestone | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const create = useMutation(tasklineMutations.createMilestone(queryClient, userId));
	const update = useMutation(tasklineMutations.updateMilestone(queryClient, userId));
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				name: milestone?.name ?? "",
				dueOn: milestone?.dueOn ?? "",
				description: milestone?.description ?? "",
			},
			validators: formValidators(milestoneFormSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			const fields = { name: value.name, description: value.description, dueOn: value.dueOn || null };
			try {
				if (milestone) {
					await update.mutateAsync({ ws, key: projectKey, id: milestone.id, ...fields });
					toast.success(m.crud_toast_saved());
				} else {
					const created = await create.mutateAsync({ ws, key: projectKey, ...fields });
					toast.success(m.taskline_milestone_created({ name: created.name }));
				}
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={milestone ? m.taskline_milestone_edit_title({ name: milestone.name }) : m.taskline_milestone_new()}
				description={m.taskline_milestone_dialog_description()}
				submitLabel={milestone ? m.crud_save() : m.taskline_milestone_create()}
				onClose={onClose}
				data-testid="milestone-dialog"
			>
				<form.AppField name="name">
					{(field) => (
						<field.TextField label={m.taskline_milestone_name()} maxLength={MILESTONE_NAME_MAX} autoComplete="off" />
					)}
				</form.AppField>
				<form.AppField name="dueOn">
					{(field) => <field.DateField label={m.taskline_field_due()} optional />}
				</form.AppField>
				<form.AppField name="description">
					{(field) => (
						<field.TextareaField
							label={m.taskline_field_description()}
							maxLength={MILESTONE_DESCRIPTION_MAX}
							optional
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
