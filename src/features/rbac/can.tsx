import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sessionQueryOptions } from "@/features/auth/queries";
import { hasAll, type Permission } from "./permissions";
import type { Actor } from "./types";

/**
 * Permissions in the UI. These only decide what to SHOW: every server function
 * checks its own permission (requirePermission), so hiding a button is a
 * courtesy, never the protection.
 */

/** The signed-in user's permissions (from the session, loaded with every SSR request). */
export function usePermissions(): ReadonlyArray<Permission> {
	const { data } = useQuery(sessionQueryOptions());
	return data?.permissions ?? [];
}

/** True when the user holds every one of `required`. */
export const useCan = (...required: Permission[]) => hasAll(usePermissions(), required);

/** Renders `children` only for users holding every one of `permission`; otherwise `fallback`. */
export function Can({
	permission,
	children,
	fallback = null,
}: {
	permission: Permission | Permission[];
	children: ReactNode;
	fallback?: ReactNode;
}) {
	const can = useCan(...(Array.isArray(permission) ? permission : [permission]));
	return <>{can ? children : fallback}</>;
}

/** The signed-in user as an actor (who is changing things), or null when signed out. */
export function useActor(): Actor | null {
	const { data } = useQuery(sessionQueryOptions());
	return data ? { id: data.user.id, isAdmin: data.user.role === "admin", permissions: data.permissions } : null;
}
