import { Fragment } from "react";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { Checkbox } from "@/components/ui/checkbox";
import { ADMIN_GROUP_LABELS, ADMIN_GROUPS, ADMIN_SECTIONS, type AdminGroup } from "@/features/admin/sections";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { RBAC_REFRESH, roleKeys } from "../keys";
import { PERMISSION_LABELS, RESOURCE_LABELS, roleLabel } from "../labels";
import { type Permission, permissionsOf, RESOURCES, type Resource } from "../permissions";
import { roleMutations } from "../queries";
import type { RolePermissionsUpdate, RoleSummary } from "../schema";
import { type Actor, canGrant } from "../types";

/** Applies a grant/revoke to the cached roles (the optimistic update). */
const applyChange = (roles: RoleSummary[], change: RolePermissionsUpdate): RoleSummary[] =>
	roles.map((role) =>
		role.id !== change.roleId
			? role
			: {
					...role,
					permissions: [...new Set([...role.permissions, ...change.grant])].filter(
						(permission) => !change.revoke.includes(permission),
					),
				},
	);

/** A resource's sidebar group: that of the first section its permissions open, "system" when none does (uploads). */
const groupOf = (resource: Resource): AdminGroup =>
	ADMIN_SECTIONS.find((section) => section.permission?.startsWith(`${resource}:`))?.group ?? "system";

/** The resources under each sidebar group, in sidebar order (empty groups left out). */
const GROUPS = ADMIN_GROUPS.map((group) => ({
	group,
	resources: RESOURCES.filter((resource) => groupOf(resource) === group),
})).filter((entry) => entry.resources.length > 0);

/**
 * Roles as columns, permissions as rows, grouped by resource under the admin
 * sidebar's groups (Overview, Access, System…). Each change saves at once: the box
 * flips immediately (optimistic), and if the server refuses (a rule, a lost
 * connection) it flips back with a message. "All" boxes set a whole resource for
 * one role. Admin is always everything and can't be changed; boxes the actor may
 * not change (permissions they don't hold) are disabled.
 */
export function PermissionMatrix({
	roles,
	actor,
	canEdit,
}: {
	roles: ReadonlyArray<RoleSummary>;
	actor: Pick<Actor, "isAdmin" | "permissions">;
	canEdit: boolean;
}) {
	const mutation = useCrudMutation(roleMutations.permissions(), {
		invalidate: RBAC_REFRESH,
		optimistic: { queryKey: roleKeys.lists(), update: applyChange },
	});

	const editable = (role: RoleSummary, permission: Permission) =>
		canEdit && role.key !== "admin" && canGrant(actor, [permission]);
	const set = (role: RoleSummary, permissions: Permission[], on: boolean) => {
		const changeable = permissions.filter((permission) => editable(role, permission));
		const grant = on ? changeable.filter((permission) => !role.permissions.includes(permission)) : [];
		const revoke = on ? [] : changeable.filter((permission) => role.permissions.includes(permission));
		if (grant.length + revoke.length > 0) mutation.mutate({ roleId: role.id, grant, revoke });
	};

	return (
		<div className="overflow-x-auto rounded-md border" data-testid="permission-matrix">
			<table className="w-full border-collapse text-sm">
				<caption className="sr-only">{m.matrix_title()}</caption>
				<thead>
					<tr className="border-b bg-muted/40">
						<th scope="col" className="sticky start-0 z-10 bg-muted px-3 py-2 text-start font-medium">
							{m.matrix_permission()}
						</th>
						{roles.map((role) => (
							<th key={role.id} scope="col" className="min-w-28 px-3 py-2 text-center font-medium">
								{roleLabel(role)}
							</th>
						))}
					</tr>
				</thead>
				{GROUPS.map(({ group, resources }) => (
					<tbody key={group}>
						<tr className="border-b bg-muted/60">
							<th
								scope="rowgroup"
								colSpan={roles.length + 1}
								className="px-3 py-1.5 text-start font-medium text-muted-foreground text-xs uppercase tracking-wide"
							>
								{ADMIN_GROUP_LABELS[group]()}
							</th>
						</tr>
						{resources.map((resource) => {
							const permissions = permissionsOf(resource);
							return (
								<Fragment key={resource}>
									<tr className="border-b bg-muted/20">
										<th scope="row" className="sticky start-0 z-10 bg-muted px-3 py-2 text-start font-semibold">
											{RESOURCE_LABELS[resource]()}
										</th>
										{roles.map((role) => {
											const held = permissions.filter((permission) => role.permissions.includes(permission)).length;
											const anyEditable = permissions.some((permission) => editable(role, permission));
											return (
												<td key={role.id} className="px-3 py-2 text-center">
													<Checkbox
														aria-label={m.matrix_all_of({
															resource: RESOURCE_LABELS[resource](),
															role: roleLabel(role),
														})}
														checked={held === permissions.length ? true : held > 0 ? "indeterminate" : false}
														disabled={!anyEditable}
														onCheckedChange={(checked) => set(role, permissions, checked === true)}
													/>
												</td>
											);
										})}
									</tr>
									{permissions.map((permission) => (
										<tr key={permission} className="border-b last:border-b-0">
											<th
												scope="row"
												className="sticky start-0 z-10 bg-background px-3 py-2 ps-6 text-start font-normal"
											>
												{PERMISSION_LABELS[permission]()}
											</th>
											{roles.map((role) => (
												<td
													key={role.id}
													className={cn("px-3 py-2 text-center", role.key === "admin" && "bg-muted/20")}
												>
													<Checkbox
														aria-label={m.matrix_toggle({
															role: roleLabel(role),
															permission: PERMISSION_LABELS[permission](),
														})}
														checked={role.permissions.includes(permission)}
														disabled={!editable(role, permission)}
														onCheckedChange={(checked) => set(role, [permission], checked === true)}
														data-permission={permission}
														data-role={role.key}
													/>
												</td>
											))}
										</tr>
									))}
								</Fragment>
							);
						})}
					</tbody>
				))}
			</table>
		</div>
	);
}
