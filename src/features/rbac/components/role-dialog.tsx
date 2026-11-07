import { formOptions } from "@tanstack/react-form";
import { useCrudForm } from "@/components/crud/use-crud-form";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, useAppForm } from "@/components/forms";
import { m } from "@/paraglide/messages";
import { RBAC_REFRESH, roleKeys } from "../keys";
import { roleMutations } from "../queries";
import { ROLE_NAME_MAX, type RoleFormValues, type RoleSummary, roleInputSchema } from "../schema";

const roleFormOptions = (role?: RoleSummary) =>
	formOptions({
		defaultValues: { name: role?.name ?? "", description: role?.description ?? "" } as RoleFormValues,
		validators: formValidators(roleInputSchema),
	});

/**
 * Create a custom role, or rename one (`role` given). Permissions are set in the
 * matrix. A rename sends the role's `updatedAt`; if someone renamed it since,
 * "Reload" refetches the roles and the list re-keys this dialog with the newer one.
 */
export function RoleDialog({ role, onClose }: { role?: RoleSummary | undefined; onClose: () => void }) {
	const crud = useCrudForm({
		item: role,
		toInput: (values: RoleFormValues) => roleInputSchema.parse(values),
		create: roleMutations.create(),
		update: roleMutations.update(),
		invalidate: RBAC_REFRESH,
		reload: roleKeys.lists(),
		onSaved: onClose,
	});
	const form = useAppForm({ ...roleFormOptions(role), ...crud.formProps });
	return (
		<form.AppForm>
			<FormDialog
				title={role ? m.roles_dialog_edit_title() : m.roles_dialog_new_title()}
				description={m.roles_dialog_description()}
				submitLabel={role ? m.crud_save() : m.crud_create()}
				onClose={onClose}
				stale={crud.stale}
				data-testid="role-dialog"
			>
				<form.AppField name="name">
					{(field) => <field.TextField label={m.roles_field_name()} maxLength={ROLE_NAME_MAX} />}
				</form.AppField>
				<form.AppField name="description">
					{(field) => <field.TextareaField label={m.roles_field_description()} optional rows={3} />}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
