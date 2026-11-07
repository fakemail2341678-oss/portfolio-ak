import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
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

function useRefresh() {
	const queryClient = useQueryClient();
	return () => Promise.all(ALL_TASKLINE_ADMIN.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function AddMembersDialog({ onClose }: { onClose: () => void }) {
	const refresh = useRefresh();
	const add = useMutation(tasklineAdminMutations.addMembers());
	const form = useAppForm({
		...formOptions({
			defaultValues: { userIds: [] as string[], role: "member" as TeamRole },
			validators: formValidators(z.object({ userIds: z.array(z.string()).min(1), role: z.enum(TEAM_ROLES) })),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const { added } = await add.mutateAsync(value);
				formApi.reset(value);
				onClose();
				toast.success(m.taskline_admin_toast_added({ count: formatNumber(added) }));
				await refresh();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
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
	const refresh = useRefresh();
	const invite = useMutation(tasklineAdminMutations.invite());
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
		onSubmit: async ({ value, formApi }) => {
			try {
				const sent = await invite.mutateAsync({ ...value, projectId: value.projectId || null });
				formApi.reset(value);
				onClose();
				toast.success(m.taskline_admin_toast_invited({ email: sent.email }));
				await refresh();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
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
	const refresh = useRefresh();
	const update = useMutation(tasklineAdminMutations.updateMember());
	const form = useAppForm({
		...formOptions({
			defaultValues: { role: member.role, title: member.title, hours: capacityHours(member.capacityMinutesWeek) },
			validators: formValidators(editSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				await update.mutateAsync({
					id: member.id,
					role: value.role,
					title: value.title.trim(),
					capacityMinutesWeek: Math.round(value.hours * 60),
				});
				formApi.reset(value);
				onClose();
				toast.success(m.crud_toast_saved());
				await refresh();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
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
	const refresh = useRefresh();
	const { data: members } = useSuspenseQuery(memberOptionsQueryOptions());
	const deactivate = useMutation(tasklineAdminMutations.deactivateMember());
	const others = members.filter((each) => each.id !== member.id);
	const form = useAppForm({
		...formOptions({
			defaultValues: { reassignTo: "" },
			validators: formValidators(z.object({ reassignTo: z.string() })),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const { reassigned } = await deactivate.mutateAsync({ id: member.id, reassignTo: value.reassignTo || null });
				formApi.reset(value);
				onClose();
				toast.success(m.taskline_admin_toast_deactivated({ name: member.name, count: formatNumber(reassigned) }));
				await refresh();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
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
