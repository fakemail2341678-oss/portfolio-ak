import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { MailPlusIcon, UserPlusIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import type { RowAction } from "@/components/data-table";
import { PageTab, PageTabs } from "@/components/page/page-tabs";
import { Button } from "@/components/ui/button";
import { Can } from "@/features/rbac/can";
import { useListPage } from "@/hooks/use-list-page";
import { m } from "@/paraglide/messages";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { activityOptionsQueryOptions, adminMemberListQueryOptions, tasklineAdminMutations } from "../queries";
import type { AdminMemberItem } from "../schema";
import { TL_ADMIN_MEMBERS_TABLE_ID } from "../search";
import { adminMemberColumns } from "./columns";
import { AdminMemberFilterControls, adminMemberFilters } from "./filters";

const dialogs = () => import("./member-dialogs");
const AddMembersDialog = lazy(() => dialogs().then((module) => ({ default: module.AddMembersDialog })));
const InviteDialog = lazy(() => dialogs().then((module) => ({ default: module.InviteDialog })));
const EditMemberDialog = lazy(() => dialogs().then((module) => ({ default: module.EditMemberDialog })));
const DeactivateMemberDialog = lazy(() => dialogs().then((module) => ({ default: module.DeactivateMemberDialog })));

const route = getRouteApi("/_admin/admin/taskline/members");

/** Members | Invitations, over both pages. */
export function MemberTabs() {
	return (
		<PageTabs label={m.taskline_admin_members_tabs()}>
			<PageTab to="/admin/taskline/members">{m.taskline_admin_members_title()}</PageTab>
			<PageTab to="/admin/taskline/invitations" data-testid="tab-invitations">
				{m.taskline_admin_invitations_title()}
			</PageTab>
		</PageTabs>
	);
}

type Open =
	| { kind: "add" }
	| { kind: "invite" }
	| { kind: "edit"; member: AdminMemberItem }
	| { kind: "deactivate"; member: AdminMemberItem }
	| null;

/** The header's buttons: add accounts, invite by email (the dialogs load on click). */
export function MemberActions({ onOpen }: { onOpen: (open: Open) => void }) {
	return (
		<Can permission="taskline:manage">
			<Button variant="outline" onClick={() => onOpen({ kind: "invite" })} data-testid="invite-member">
				<MailPlusIcon aria-hidden />
				{m.taskline_admin_invite()}
			</Button>
			<Button onClick={() => onOpen({ kind: "add" })} data-testid="add-members">
				<UserPlusIcon aria-hidden />
				{m.taskline_admin_add_people()}
			</Button>
		</Can>
	);
}

/** The dialog that's open, if any. */
export function MemberDialogs({ open, onClose }: { open: Open; onClose: () => void }) {
	const { data: options } = useSuspenseQuery(activityOptionsQueryOptions());
	if (!open) return null;
	return (
		<Suspense fallback={null}>
			{open.kind === "add" ? <AddMembersDialog onClose={onClose} /> : null}
			{open.kind === "invite" ? <InviteDialog projects={options.projects} onClose={onClose} /> : null}
			{open.kind === "edit" ? <EditMemberDialog member={open.member} onClose={onClose} /> : null}
			{open.kind === "deactivate" ? <DeactivateMemberDialog member={open.member} onClose={onClose} /> : null}
		</Suspense>
	);
}

/**
 * /admin/taskline/members (decision 0212): the team, Taskline's own list. Each member's
 * role, title, weekly capacity and open work; deactivating takes them off the team (their
 * tasks go to someone else or nobody, their history stays), reactivating brings them back.
 */
export function AdminMemberList() {
	const search = route.useSearch();
	const list = useListPage({ tableId: TL_ADMIN_MEMBERS_TABLE_ID, search, query: adminMemberListQueryOptions });
	const [open, setOpen] = useState<Open>(null);
	const reactivate = useCrudMutation(tasklineAdminMutations.reactivateMember(), { invalidate: ALL_TASKLINE_ADMIN });

	const rowActions = (row: AdminMemberItem): RowAction[] => [
		{
			id: "edit",
			label: m.crud_edit(),
			permission: "taskline:manage",
			hidden: row.deactivated,
			onSelect: () => setOpen({ kind: "edit", member: row }),
		},
		{
			id: "deactivate",
			label: m.taskline_admin_deactivate(),
			permission: "taskline:manage",
			destructive: true,
			separated: true,
			hidden: row.deactivated,
			onSelect: () => setOpen({ kind: "deactivate", member: row }),
		},
		{
			id: "reactivate",
			label: m.taskline_admin_reactivate(),
			permission: "taskline:manage",
			hidden: !row.deactivated || row.userId === null,
			onSelect: () =>
				reactivate.mutate(
					{ id: row.id },
					{ onSuccess: () => toast.success(m.taskline_admin_toast_reactivated({ name: row.name })) },
				),
		},
	];

	return (
		<CrudListPage
			title={m.taskline_admin_members_title()}
			description={m.taskline_admin_members_description()}
			actions={<MemberActions onOpen={setOpen} />}
			tabs={<MemberTabs />}
			tableId={TL_ADMIN_MEMBERS_TABLE_ID}
			list={list}
			columns={adminMemberColumns}
			getRowLabel={(row) => row.name}
			search={search}
			filters={{ controls: <AdminMemberFilterControls search={search} />, ...adminMemberFilters.applied(search) }}
			rowActions={rowActions}
			empty={{ description: m.taskline_admin_members_empty(), filtered: m.taskline_admin_members_empty_filtered() }}
			exportName="taskline-members"
			data-testid="taskline-admin-members"
		>
			<MemberDialogs open={open} onClose={() => setOpen(null)} />
		</CrudListPage>
	);
}
