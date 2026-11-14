import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useCrudForm } from "@/components/crud/use-crud-form";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, useAppForm } from "@/components/forms";
import { RelationField } from "@/components/forms/fields/async-combobox-field";
import { formatNumber } from "@/lib/i18n/intl";
import { optionalText } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { TEAM_ROLES, type TeamRole } from "../../types";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { capacityHours, TEAM_ROLE_LABELS } from "../labels";
import { accountSearch, memberOptionsQueryOptions, tasklineAdminMutations } from "../queries";
import { type AdminMemberItem, CAPACITY_HOURS_MAX, TITLE_MAX } from "../schema";

/**
 * /admin/taskline/members' dialogs, loaded on click (decision 0168): adding accounts,
 * inviting by email, editing a member, deactivating one. Each saves, refreshes the
 * section and closes; a refusal shows on its field.
 */

const roleOptions = () => TEAM_ROLES.map((role) => ({ value: role, label: TEAM_ROLE_LABELS[role]() }));

export function AddMembersDialog({ onClose }: { onClose: () => void }) {
	const crud = useCrudForm({
		toInput: (values: { userIds: string[]; role: TeamRole }) => values,
		create: tasklineAdminMutations.addMembers(),
		invalidate: ALL_TASKLINE_ADMIN,
		onSaved: onClose,
		messages: { created: (_input, { added }) => m.taskline_admin_toast_added({ count: formatNumber(added) }) },
	});
	const form = useAppForm({
		...formOptions({
			defaultValues: { userIds: [] as string[], role: "member" as TeamRole },
			validators: formValidators(z.object({ userIds: z.array(z.string()).min(1), role: z.enum(TEAM_ROLES) })),
		}),
		...crud.formProps,
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.taskline_admin_add_people()}
				description={m.taskline_admin_add_people_description()}
				submitLabel={m.taskline_admin_add()}
				onClose={onClose}
				data-testid="add-members-dialog"
			>
				<form.AppField name="userIds">
					{() => (
						<RelationField
							label={m.taskline_admin_accounts()}
							relation={accountSearch}
							multiple
							max={20}
							searchPlaceholder={m.taskline_admin_accounts_search()}
						/>
					)}
				</form.AppField>
				<form.AppField name="role">
					{(field) => <field.RadioGroupField label={m.taskline_admin_team_role()} options={roleOptions()} />}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}

export function InviteDialog({
	projects,
	onClose,
}: {
	projects: ReadonlyArray<{ id: string; key: string; name: string }>;
	onClose: () => void;
}) {
	const crud = useCrudForm({
		toInput: (values: { email: string; role: TeamRole; projectId: string }) => ({
			...values,
			projectId: values.projectId || null,
		}),
		create: tasklineAdminMutations.invite(),
		invalidate: ALL_TASKLINE_ADMIN,
		onSaved: onClose,
		messages: { created: (_input, sent) => m.taskline_admin_toast_invited({ email: sent.email }) },
	});
	const form = useAppForm({
		...formOptions({
			defaultValues: { email: "", role: "member" as TeamRole, projectId: "" },
			validators: formValidators(
				z.object({
					email: z.email({ error: () => m.validation_email() }),
					role: z.enum(TEAM_ROLES),
					projectId: z.string(),
				}),
			),
		}),
		...crud.formProps,
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.taskline_admin_invite()}
				description={m.taskline_admin_invite_description()}
				submitLabel={m.taskline_admin_invite_send()}
				onClose={onClose}
				data-testid="invite-member-dialog"
			>
				<form.AppField name="email">
					{(field) => <field.EmailField label={m.taskline_admin_col_email()} autoComplete="off" />}
				</form.AppField>
				<form.AppField name="role">
					{(field) => <field.RadioGroupField label={m.taskline_admin_team_role()} options={roleOptions()} />}
				</form.AppField>
				<form.AppField name="projectId">
					{(field) => (
						<field.SelectField
							label={m.taskline_admin_invite_project()}
							description={m.taskline_admin_invite_project_hint()}
							options={[
								{ value: "", label: m.taskline_admin_invite_no_project() },
								...projects.map((project) => ({ value: project.id, label: `${project.key} · ${project.name}` })),
							]}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}

const editSchema = z.object({
	role: z.enum(TEAM_ROLES),
	title: optionalText({ max: TITLE_MAX }),
	hours: z.number().min(0).max(CAPACITY_HOURS_MAX),
});

export function EditMemberDialog({ member, onClose }: { member: AdminMemberItem; onClose: () => void }) {
	const crud = useCrudForm({
		toInput: (values: { role: TeamRole; title: string; hours: number }) => ({
			id: member.id,
			role: values.role,
			title: values.title.trim(),
			capacityMinutesWeek: Math.round(values.hours * 60),
		}),
		create: tasklineAdminMutations.updateMember(),
		invalidate: ALL_TASKLINE_ADMIN,
		onSaved: onClose,
		messages: { created: () => m.crud_toast_saved() },
	});
	const form = useAppForm({
		...formOptions({
			defaultValues: { role: member.role, title: member.title, hours: capacityHours(member.capacityMinutesWeek) },
			validators: formValidators(editSchema),
		}),
		...crud.formProps,
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.taskline_admin_edit_member({ name: member.name })}
				submitLabel={m.crud_save()}
				onClose={onClose}
				data-testid="edit-member-dialog"
			>
				<form.AppField name="role">
					{(field) => <field.RadioGroupField label={m.taskline_admin_team_role()} options={roleOptions()} />}
				</form.AppField>
				<form.AppField name="title">
					{(field) => <field.TextField label={m.taskline_admin_col_title()} maxLength={TITLE_MAX} optional />}
				</form.AppField>
				<form.AppField name="hours">
					{(field) => (
						<field.NumberField
							label={m.taskline_admin_capacity_hours()}
							description={m.taskline_admin_capacity_hint()}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}

export function DeactivateMemberDialog({ member, onClose }: { member: AdminMemberItem; onClose: () => void }) {
	const { data: members } = useSuspenseQuery(memberOptionsQueryOptions());
	const crud = useCrudForm({
		toInput: (values: { reassignTo: string }) => ({ id: member.id, reassignTo: values.reassignTo || null }),
		create: tasklineAdminMutations.deactivateMember(),
		invalidate: ALL_TASKLINE_ADMIN,
		onSaved: onClose,
		messages: {
			created: (_input, { reassigned }) =>
				m.taskline_admin_toast_deactivated({ name: member.name, count: formatNumber(reassigned) }),
		},
	});
	const others = members.filter((each) => each.id !== member.id);
	const form = useAppForm({
		...formOptions({
			defaultValues: { reassignTo: "" },
			validators: formValidators(z.object({ reassignTo: z.string() })),
		}),
		...crud.formProps,
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.taskline_admin_deactivate_title({ name: member.name })}
				description={m.taskline_admin_deactivate_body({ count: formatNumber(member.open) })}
				submitLabel={m.taskline_admin_deactivate()}
				onClose={onClose}
				data-testid="deactivate-member-dialog"
			>
				<form.AppField name="reassignTo">
					{(field) => (
						<field.SelectField
							label={m.taskline_admin_reassign_to()}
							options={[
								{ value: "", label: m.taskline_admin_leave_unassigned() },
								...others.map((each) => ({ value: each.id, label: each.name })),
							]}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
