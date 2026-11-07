import type { Permission } from "@/features/rbac/permissions";

/** Better Auth's admin flag ("admin" holds every permission; see decisions.md 0094). */
export type Role = "user" | "admin";

export type SessionUser = {
	id: string;
	email: string;
	name: string;
	role: Role;
	twoFactorEnabled: boolean;
};

/**
 * Session shape shared by the router context and server middleware. `permissions`
 * is resolved on the server for every request (roles can change at any time);
 * the browser uses it only to show or hide UI.
 */
export type Session = {
	user: SessionUser;
	permissions: Permission[];
	/**
	 * Set when AUTH_REQUIRE_ADMIN_2FA is on and this user holds admin permissions
	 * without two-factor turned on. `permissions` is then empty until they set it up
	 * (decisions.md 0126).
	 */
	twoFactorRequired?: true;
	/**
	 * Set on a session an admin opened as this user (impersonation, decisions.md
	 * 0134): the admin's user id. The app shows a banner with a way back.
	 */
	impersonatedBy?: string;
	/**
	 * Set on a guest session (Better Auth's anonymous plugin, decision 0185): a
	 * visitor trying the apps without an account. `permissions` is always empty,
	 * the account pages are closed to them, and signing up or in keeps their data.
	 */
	isAnonymous?: true;
};
