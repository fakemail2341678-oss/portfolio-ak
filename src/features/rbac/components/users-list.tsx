import { getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { crudFormKey } from "@/components/crud/use-crud-form";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import type { RowAction } from "@/components/data-table";
import { type ConfirmOptions, useConfirm } from "@/components/dialogs/confirm";
import { Button } from "@/components/ui/button";
import { useListPage } from "@/hooks/use-list-page";
import { useListQuery } from "@/hooks/use-list-query";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";
import { Can, useActor } from "../can";
import { userColumns } from "../columns";
import { UserFilterControls, userFilters } from "../filters";
import { RBAC_REFRESH } from "../keys";
import { roleOptionsQueryOptions, userMutations, usersListQueryOptions } from "../queries";
import type { UserListItem } from "../schema";
import { USERS_TABLE_ID } from "../search";

const route = getRouteApi("/_admin/admin/users/");

// Opened on click: their forms (and every field they use) load then, not with the page.
const InviteUserDialog = lazy(() =>
	import("./invite-user-dialog").then((module) => ({ default: module.InviteUserDialog })),
);
const UserRolesDialog = lazy(() =>
	import("./user-roles-dialog").then((module) => ({ default: module.UserRolesDialog })),
);

/**
 * /admin/users: search and filters from the URL, and per user: roles (a dialog),
 * viewing as them, signing them out everywhere, banning. Each asks first; the
 * server applies the escalation and lockout rules again.
 */
export function UsersList() {
	const search = route.useSearch();
	const actor = useActor();
	const list = useListPage({ tableId: USERS_TABLE_ID, search, query: usersListQueryOptions });
	const { data: roles = [] } = useListQuery(roleOptionsQueryOptions());
	/** The user whose roles are being edited (by id: the dialog shows them as the list has them now). */
	const [editing, setEditing] = useState<string | null>(null);
	const [inviting, setInviting] = useState(false);
	const confirm = useConfirm();
	const ban = useCrudMutation(userMutations.ban(), { invalidate: RBAC_REFRESH });
	const revoke = useCrudMutation(userMutations.revokeSessions(), { invalidate: RBAC_REFRESH });
	// A new session (as the user): the app loads again from the server, on their account page
	// (the home page is the portfolio, which doesn't read the session, so it shows no banner).
	const impersonate = useCrudMutation(userMutations.impersonate(), { invalidate: [] });
	const ask = async (options: ConfirmOptions, run: () => void) => {
		if (await confirm(options)) run();
	};

	// Impersonation is for admins only, never of another admin (the server refuses the rest too).
	const canImpersonate = (row: UserListItem) => actor?.isAdmin === true && !row.isAdmin && !row.banned;
	// No actions on your own row: roles, bans and sessions of the signed-in user are changed elsewhere.
	const rowActions = (row: UserListItem): RowAction[] => {
		if (row.id === actor?.id) return [];
		const name = row.name;
		return [
			{ id: "roles", label: m.users_edit_roles(), permission: "users:update", onSelect: () => setEditing(row.id) },
			{
				id: "impersonate",
				label: m.users_impersonate(),
				hidden: !canImpersonate(row),
				onSelect: () =>
					void ask(
						{
							title: m.users_impersonate_title({ name }),
							description: m.users_impersonate_body(),
							confirmLabel: m.users_impersonate(),
						},
						() => impersonate.mutate(row.id, { onSuccess: () => window.location.assign(localizeHref("/account")) }),
					),
			},
			{
				id: "revoke",
				label: m.users_revoke_sessions(),
				permission: "users:ban",
				onSelect: () =>
					void ask(
						{
							title: m.users_revoke_title({ name }),
							description: m.users_revoke_body(),
							confirmLabel: m.users_revoke_sessions(),
						},
						() => revoke.mutate(row.id, { onSuccess: () => toast.success(m.users_toast_revoked({ name })) }),
					),
			},
			{
				id: "ban",
				label: row.banned ? m.users_unban() : m.users_ban(),
				permission: "users:ban",
				destructive: !row.banned,
				onSelect: () =>
					void ask(
						row.banned
							? {
									title: m.users_unban_title({ name }),
									description: m.users_unban_body(),
									confirmLabel: m.users_unban(),
								}
							: {
									title: m.users_ban_title({ name }),
									description: m.users_ban_body(),
									confirmLabel: m.users_ban(),
									destructive: true,
								},
						() =>
							ban.mutate(
								{ userId: row.id, banned: !row.banned },
								{
									onSuccess: () =>
										toast.success(row.banned ? m.users_toast_unbanned({ name }) : m.users_toast_banned({ name })),
								},
							),
					),
			},
		];
	};
	const user = editing ? list.page?.items.find((row) => row.id === editing) : undefined;

	return (
		<CrudListPage
			title={m.users_title()}
			description={m.users_description()}
			actions={
				<Can permission="users:invite">
					<Button onClick={() => setInviting(true)}>{m.users_invite()}</Button>
				</Can>
			}
			tableId={USERS_TABLE_ID}
			list={list}
			columns={userColumns(actor?.id)}
			getRowLabel={(row) => row.name}
			search={search}
			filters={{
				controls: <UserFilterControls search={search} roles={roles} />,
				...userFilters.applied(search, roles),
			}}
			rowActions={rowActions}
			empty={{ description: m.users_empty() }}
			exportName="users"
			data-testid="users-table"
		>
			<Suspense>
				{user && actor ? (
					<UserRolesDialog
						key={crudFormKey(user)}
						user={user}
						roles={roles}
						actor={actor}
						onClose={() => setEditing(null)}
					/>
				) : null}
				{inviting ? <InviteUserDialog onClose={() => setInviting(false)} /> : null}
			</Suspense>
		</CrudListPage>
	);
}
