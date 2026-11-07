import { formOptions } from "@tanstack/react-form";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { m } from "@/paraglide/messages";
import { APP_COLOR_LABELS, APP_COLORS, type AppColor } from "../../colors";
import { CATEGORY_ICON_LABELS } from "../icons";
import { CATEGORY_NAME_MAX, categoryName } from "../schema";
import { CATEGORY_ICONS, type CategoryIcon, type ExpenseCategory } from "../types";

const categoryFormSchema = z.object({
	name: categoryName(),
	color: z.enum(APP_COLORS),
	icon: z.enum(CATEGORY_ICONS),
});
type CategoryFormValues = z.input<typeof categoryFormSchema>;

/**
 * Making or editing a category (decision 0192): its name (unique for the user, any
 * case), colour and icon. Loaded on click (decision 0168).
 */
export default function CategoryDialog({
	category,
	onSubmit,
	onClose,
}: {
	category?: ExpenseCategory;
	onSubmit: (values: { name: string; color: AppColor; icon: CategoryIcon }) => Promise<unknown>;
	onClose: () => void;
}) {
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				name: category?.name ?? "",
				color: category?.color ?? "blue",
				icon: category?.icon ?? "tag",
			} as CategoryFormValues,
			validators: formValidators(categoryFormSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				await onSubmit(categoryFormSchema.parse(value));
				formApi.reset(value);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={category ? m.expenses_category_edit() : m.expenses_category_new()}
				submitLabel={category ? m.crud_save() : m.crud_create()}
				onClose={onClose}
				data-testid="category-dialog"
			>
				<form.AppField name="name">
					{(field) => (
						<field.TextField label={m.expenses_field_name()} maxLength={CATEGORY_NAME_MAX} autoComplete="off" />
					)}
				</form.AppField>
				<div className="grid gap-4 sm:grid-cols-2">
					<form.AppField name="color">
						{(field) => (
							<field.SelectField
								label={m.apps_field_color()}
								options={APP_COLORS.map((color) => ({ value: color, label: APP_COLOR_LABELS[color]() }))}
							/>
						)}
					</form.AppField>
					<form.AppField name="icon">
						{(field) => (
							<field.SelectField
								label={m.expenses_field_icon()}
								options={CATEGORY_ICONS.map((icon) => ({ value: icon, label: CATEGORY_ICON_LABELS[icon]() }))}
							/>
						)}
					</form.AppField>
				</div>
			</FormDialog>
		</form.AppForm>
	);
}
