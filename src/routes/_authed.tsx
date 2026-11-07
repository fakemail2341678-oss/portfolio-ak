import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header/app-header";
import { fontPreloads } from "@/lib/fonts";
import { NOINDEX } from "@/lib/seo";
import { getLocale } from "@/paraglide/runtime";

/**
 * Pages that need a signed-in user. Anonymous visitors go to /login with a
 * return URL; guests (decision 0185) to /upgrade, which offers an account that
 * keeps what they made. The session in context is resolved on the server during
 * SSR (Phase 6); server functions must still check it themselves (requireUserMiddleware).
 */
export const Route = createFileRoute("/_authed")({
	beforeLoad: ({ context, location }) => {
		if (!context.session) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
		if (context.session.isAnonymous) {
			throw redirect({ to: "/upgrade", search: { redirect: location.href } });
		}
		// Narrow the type for child routes: session is non-null below this layout.
		return { session: context.session };
	},
	head: () => ({ meta: [NOINDEX], links: fontPreloads(getLocale()) }),
	component: () => (
		<>
			<AppHeader />
			<Outlet />
		</>
	),
});
