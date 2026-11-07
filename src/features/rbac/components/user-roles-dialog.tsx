import { formOptions } from "@tanstack/react-form";
import { z } from "zod";
import { useCrudForm } from "@/components/crud/use-crud-form";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, useAppForm } from "@/components/forms";
import { m } from "@/paraglide/messages";
import { RBAC_REFRESH, userKeys } from "../keys";
import { roleDescription, roleLabel } from "../labels";
import { userMutations } from "../queries";
import type { RoleSummary, UserListItem } from "../schema";
import { type Actor, canGrant } from "../types";

const formSchema = z.object({ admin: z.boolean(), roleIds: z.array(z.string()) });
type UserRolesValues = z.input<typeof formSchema>;

const userRolesFormOptions = (user: UserListItem) =>
	formOptions({
		defaultValues: { admin: user.isAdmin, roleIds: user.roles.map((role) => role.id) } as UserRolesValues,
		validators: formValidators(formSchema),
	});

/**
 * A user's roles: the Admin flag and custom roles. Options the actor may not
 * hand out are shown disabled (the same rules the server enforces: only admins
 * make admins; others only hand out roles within their own permissions). The
 * save sends the user's version: if someone changed them since, "Reload".
 */
export function UserRolesDialog({
	user,
	roles,
	actor,
	onClose,
}: {
	user: UserListItem;
	roles: ReadonlyArray<RoleSummary>;
	actor: Pick<Actor, "id" | "isAdmin" | "permissions">;
	onClose: () => void;
}) {
	const crud = useCrudForm({
		item: user,
		toInput: (values: UserRolesValues) => formSchema.parse(values),
		update: userMutations.roles(),
		invalidate: RBAC_REFRESH,
		reload: userKeys.lists(),
		onSaved: onClose,
		messages: { saved: m.users_toast_roles_saved },
	});
	const form = useAppForm({ ...userRolesFormOptions(user), ...crud.formProps });
	const self = user.id === actor.id;
	const custom = roles.filter((role) => !role.system);
	const locked = self || (user.isAdmin && !actor.isAdmin);
	return (
		<form.AppForm>
			<FormDialog
				title={m.users_roles_dialog_title({ name: user.name })}
				description={self ? m.users_roles_self() : m.users_roles_dialog_description()}
				submitLabel={m.users_roles_save()}
				readOnly={locked}
				onClose={onClose}
				stale={crud.stale}
				data-testid="user-roles-dialog"
			>
				<form.AppField name="admin">
					{(field) => (
						<field.CheckboxField
							label={m.role_admin_name()}
							description={m.role_admin_description()}
							disabled={locked || !actor.isAdmin}
						/>
					)}
				</form.AppField>
				{custom.length > 0 ? (
					<form.AppField name="roleIds">
						{(field) => (
							<field.CheckboxGroupField
								label={m.users_col_roles()}
								optional
								options={custom.map((role) => ({
									value: role.id,
									label: roleLabel(role),
									description: roleDescription(role) || undefined,
									disabled: locked || !canGrant(actor, role.permissions),
								}))}
							/>
						)}
					</form.AppField>
				) : null}
			</FormDialog>
		</form.AppForm>
	);
}
