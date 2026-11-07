import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusBadge } from "@/components/data-display/status-badge";
import type { DataTableColumn } from "@/components/data-table";
import { useConfirm } from "@/components/dialogs/confirm";
import { formatDate } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { TEAM_ROLE_LABELS } from "../labels";
import { invitationsQueryOptions, tasklineAdminMutations } from "../queries";
import type { AdminInvitation } from "../schema";
import { MemberActions, MemberDialogs, MemberTabs } from "./member-list";

const columns: ReadonlyArray<DataTableColumn<AdminInvitation>> = [
	{
		id: "email",
		header: m.taskline_admin_col_email,
		cell: (row) => <span className="font-medium">{row.email}</span>,
		csv: (row) => row.email,
	},
	{ id: "role", header: m.taskline_admin_col_role, cell: (row) => TEAM_ROLE_LABELS[row.role]() },
	{
		id: "project",
		header: m.taskline_admin_col_project,
		cell: (row) =>
			row.project ? `${row.project.key} · ${row.project.name}` : <span className="text-muted-foreground">—</span>,
	},
	{
		id: "invitedBy",
		header: m.taskline_admin_col_invited_by,
		hideable: true,
		cell: (row) => row.invitedBy ?? <span className="text-muted-foreground">—</span>,
	},
	{
		id: "expires",
		header: m.taskline_admin_col_expires,
		cellClassName: "whitespace-nowrap",
		cell: (row) =>
			row.expired ? (
				<StatusBadge tone="neutral">{m.taskline_admin_invitation_expired()}</StatusBadge>
			) : (
				formatDate(row.expiresAt, { dateStyle: "medium" })
			),
	},
];

/**
 * /admin/taskline/invitations: who was invited and hasn't joined. The email's link signs
 * them up (or in) and into Taskline; joining happens on their first verified sign-in
 * (decision 0212). Resend starts the days again; revoke stops it working.
 */
export function AdminInvitationList() {
	const { data: invitations } = useSuspenseQuery(invitationsQueryOptions());
	const [open, setOpen] = useState<Parameters<typeof MemberDialogs>[0]["open"]>(null);
	const confirm = useConfirm();
	const resend = useCrudMutation(tasklineAdminMutations.resendInvitation(), { invalidate: ALL_TASKLINE_ADMIN });
	const revoke = useCrudMutation(tasklineAdminMutations.revokeInvitation(), { invalidate: ALL_TASKLINE_ADMIN });
	return (
		<CrudListPage
			title={m.taskline_admin_invitations_title()}
			description={m.taskline_admin_invitations_description()}
			actions={<MemberActions onOpen={setOpen} />}
			tabs={<MemberTabs />}
			tableId="admin-taskline-invitations"
			list={{ rows: invitations }}
			columns={columns}
			getRowLabel={(row) => row.email}
			rowActions={(row) => [
				{
					id: "resend",
					label: m.taskline_admin_resend(),
					permission: "taskline:manage",
					onSelect: () =>
						resend.mutate(
							{ id: row.id },
							{ onSuccess: () => toast.success(m.taskline_admin_toast_invited({ email: row.email })) },
						),
				},
				{
					id: "revoke",
					label: m.taskline_admin_revoke(),
					permission: "taskline:manage",
					destructive: true,
					separated: true,
					onSelect: async () => {
						const confirmed = await confirm({
							title: m.taskline_admin_revoke_title({ email: row.email }),
							description: m.taskline_admin_revoke_body(),
							confirmLabel: m.taskline_admin_revoke(),
							destructive: true,
						});
						if (confirmed) {
							revoke.mutate({ id: row.id }, { onSuccess: () => toast.success(m.taskline_admin_toast_revoked()) });
						}
					},
				},
			]}
			empty={{ description: m.taskline_admin_invitations_empty() }}
			data-testid="taskline-admin-invitations"
		>
			<MemberDialogs open={open} onClose={() => setOpen(null)} />
		</CrudListPage>
	);
}
