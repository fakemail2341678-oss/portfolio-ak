import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell/admin-shell";
import { canEnterAdmin } from "@/features/rbac/permissions";
import { ensureAdminAccess } from "@/functions/auth";
import { isAppError } from "@/lib/errors";
import { fontPreloads } from "@/lib/fonts";
import { NOINDEX } from "@/lib/seo";
import { setErrorStatus } from "@/lib/start/http-status";
import { getLocale } from "@/paraglide/runtime";

/**
 * Admin area. Entering it (and every SSR request) checks the role ON THE SERVER
 * (ensureAdminAccess: the user must hold at least one permission, read from the database).
 * Anonymous visitors go to /login with a return URL; signed-in non-admins get
 * the localized FORBIDDEN error page; admins who must turn on two-factor first
 * (AUTH_REQUIRE_ADMIN_2FA) go to the account page's two-factor section.
 *
 * Navigations inside the area (another admin page, a filter or page change)
 * reuse the session the root route already loaded instead of another round
 * trip: every admin server function runs the same middleware on every call, so
 * a revoked role still gets nothing but FORBIDDEN. See decisions.md 0090.
 */
export const Route = createFileRoute("/_admin")({
	beforeLoad: async ({ location, cause, context }) => {
		const known = context.session;
		if (cause === "stay" && known && canEnterAdmin(known.permissions)) return { session: known };
		try {
			return { session: await ensureAdminAccess() };
		} catch (error) {
			if (isAppError(error) && error.code === "UNAUTHORIZED") {
				throw redirect({ to: "/login", search: { redirect: location.href } });
			}
			// AUTH_REQUIRE_ADMIN_2FA: set up two-factor on the account page first (0126).
			if (isAppError(error) && error.reason === "two-factor-required") {
				throw redirect({ to: "/account", search: { twoFactor: "required" }, hash: "two-factor" });
			}
			// Serve the FORBIDDEN page with a real 403 during SSR.
			await setErrorStatus(error);
			throw error;
		}
	},
	// Private: every admin page inherits this (child heads set only the title).
	head: () => ({ meta: [NOINDEX], links: fontPreloads(getLocale()) }),
	// The shell is in this route's chunk (inline component), not in every page's JavaScript.
	component: () => (
		<AdminShell>
			<Outlet />
		</AdminShell>
	),
});
