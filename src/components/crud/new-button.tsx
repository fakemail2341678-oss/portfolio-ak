import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { AdminPath } from "@/features/admin/sections";
import { useCan } from "@/features/rbac/can";
import type { Permission } from "@/features/rbac/permissions";

/** "New …" in a list's header and empty state: a link to the create page, for users holding `permission`. */
export function NewButton({
	to,
	permission,
	children,
}: {
	to: AdminPath;
	permission: Permission;
	children: ReactNode;
}) {
	if (!useCan(permission)) return null;
	return (
		<Button asChild>
			<Link to={to}>
				<PlusIcon aria-hidden />
				{children}
			</Link>
		</Button>
	);
}
