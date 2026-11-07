import { useSuspenseQuery } from "@tanstack/react-query";
import { InfoIcon } from "lucide-react";
import { Page, PageHeader } from "@/components/page/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { m } from "@/paraglide/messages";
import { useActor, useCan } from "../can";
import { rolesQueryOptions } from "../queries";
import { PermissionMatrix } from "./permission-matrix";
import { RoleTabs } from "./role-tabs";

/** /admin/roles/permissions: the matrix, editable with roles:manage (within the actor's own permissions). */
export function PermissionsPage() {
	const { data: roles } = useSuspenseQuery(rolesQueryOptions());
	const actor = useActor();
	const canEdit = useCan("roles:manage");
	return (
		<Page width="admin">
			<PageHeader title={m.matrix_title()} description={m.matrix_description()} tabs={<RoleTabs />} />
			{canEdit ? null : (
				<Alert variant="info" role="note">
					<InfoIcon aria-hidden />
					<AlertDescription>{m.matrix_read_only()}</AlertDescription>
				</Alert>
			)}
			<PermissionMatrix roles={roles} actor={actor ?? { isAdmin: false, permissions: [] }} canEdit={canEdit} />
		</Page>
	);
}
