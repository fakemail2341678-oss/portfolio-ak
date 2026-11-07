import { formOptions } from "@tanstack/react-form";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { required } from "@/lib/validation";

/**
 * A one-field dialog naming something (a new board, a board or column renamed).
 * `onSubmit` resolves once saved (the dialog closes) or rejects (the form shows why).
 * Loaded on click (decision 0168).
 */
export default function NameDialog({
	title,
	label,
	submitLabel,
	initial = "",
	max,
	onSubmit,
	onClose,
	testId,
}: {
	title: string;
	label: string;
	submitLabel: string;
	initial?: string;
	max: number;
	onSubmit: (name: string) => Promise<unknown>;
	onClose: () => void;
	testId: string;
}) {
	const form = useAppForm({
		...formOptions({
			defaultValues: { name: initial },
			validators: formValidators(z.object({ name: required({ max }) })),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				await onSubmit(value.name.trim());
				formApi.reset(value);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog title={title} submitLabel={submitLabel} onClose={onClose} data-testid={testId}>
				<form.AppField name="name">
					{(field) => <field.TextField label={label} maxLength={max} autoComplete="off" />}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
