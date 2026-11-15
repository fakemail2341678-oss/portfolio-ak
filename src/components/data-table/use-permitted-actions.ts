import { usePermissions } from "@/features/rbac/hooks/use-can";
import { hasAll } from "@/features/rbac/lib/permissions";
import type { RowAction } from "./row-actions";

/** The actions this user may run on this row. */
export function usePermittedActions() {
	const permissions = usePermissions();
	return (actions: ReadonlyArray<RowAction>) =>
		actions.filter((action) => {
			if (action.hidden) return false;
			if (!action.permission) return true;
			const required = typeof action.permission === "string" ? [action.permission] : action.permission;
			return hasAll(permissions, required);
		});
}
