import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth-shell/auth-shell";
import { staticCrumb } from "@/lib/breadcrumbs";
import { fontPreloads } from "@/lib/fonts";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/**
 * Pages anyone may open that belong to no section: health, verify email and reset
 * password (these can't sit under _auth, which sends signed-in users away, decision
 * 0046). They share the sign-in pages' frame (AuthShell) and add the "Home" breadcrumb.
 */
export const Route = createFileRoute("/_public")({
	staticData: { breadcrumb: staticCrumb(m.nav_home) },
	// Each section preloads the fonts it renders first (the portfolio has its own).
	head: () => ({ links: fontPreloads(getLocale()) }),
	component: () => (
		<AuthShell>
			<Outlet />
		</AuthShell>
	),
});
