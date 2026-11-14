import { useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { useCrudCollection } from "@/components/crud/use-crud-collection";
import { crudFormKey } from "@/components/crud/use-crud-form";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import type { RowAction } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { deleteRows } from "@/lib/crud/collection";
import { m } from "@/paraglide/messages";
import { Can } from "../can";
import { roleRows } from "../collection";
import { roleColumns } from "../columns";
import { RBAC_REFRESH } from "../keys";
import { roleLabel } from "../labels";
import { roleMutations, rolesQueryOptions } from "../queries";
import type { RoleSummary } from "../schema";
import { ROLES_TABLE_ID } from "../search";
import { RoleTabs } from "./role-tabs";

// Opened on click: the form loads then, not with the page.
const RoleDialog = lazy(() => import("./role-dialog").then((module) => ({ default: module.RoleDialog })));

/** /admin/roles: every role, read whole (system roles first). System roles can't be renamed or deleted. */
export function RolesList() {
	const { data: roles } = useSuspenseQuery(rolesQueryOptions());
	/** The dialog: a new role (no id) or renaming one. */
	const [editing, setEditing] = useState<{ id?: string } | null>(null);
	const collection = useCrudCollection(roleRows);
	const remove = useCrudMutation(roleMutations.delete(), {
		invalidate: RBAC_REFRESH,
		optimistic: (id) => deleteRows(collection, [id]),
	});
	// The dialog shows the role as it is in the list, so a reloaded newer version re-keys it.
	const role = editing?.id ? roles.find((each) => each.id === editing.id) : undefined;
	const rowActions = (row: RoleSummary): RowAction[] =>
		row.system
			? []
			: [
					{
						id: "rename",
						label: m.roles_rename(),
						permission: "roles:manage",
						onSelect: () => setEditing({ id: row.id }),
					},
				];

	return (
		<CrudListPage
			title={m.roles_title()}
			description={m.roles_description()}
			tabs={<RoleTabs />}
			actions={
				<Can permission="roles:manage">
					<Button onClick={() => setEditing({})}>
						<PlusIcon aria-hidden />
						{m.roles_new()}
					</Button>
				</Can>
			}
			tableId={ROLES_TABLE_ID}
			list={{ rows: roles }}
			collection={collection}
			columns={roleColumns}
			getRowLabel={roleLabel}
			rowActions={rowActions}
			remove={{
				permission: "roles:manage",
				run: (ids) => Promise.all(ids.map((id) => remove.mutateAsync(id))),
				can: (row) => !row.system,
				bulk: false,
				description: m.roles_delete_body,
			}}
			exportName="roles"
			data-testid="roles-table"
		>
			<Suspense>
				{editing && (!editing.id || role) ? (
					<RoleDialog key={crudFormKey(role)} role={role} onClose={() => setEditing(null)} />
				) : null}
			</Suspense>
		</CrudListPage>
	);
}
