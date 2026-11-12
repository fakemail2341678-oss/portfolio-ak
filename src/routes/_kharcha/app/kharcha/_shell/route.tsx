import { createFileRoute, redirect } from "@tanstack/react-router";
import { kharchaLinks } from "@/features/kharcha/links";
import { KharchaShellLayout, KharchaShellNotFound } from "@/features/kharcha/shell/section";
import { ensureQuery } from "@/lib/query";

/**
 * Kharcha's signed-in app: its shell (the rail, or the phone's bar, tabs and +) around every
 * page. Anyone signed in may enter, a guest too (they have sample data); visitors go to
 * Kharcha's sign-in with a way back. What each page shows is the server's call (0277).
 */
export const Route = createFileRoute("/_kharcha/app/kharcha/_shell")({
	beforeLoad: ({ context, location }) => {
		if (!context.session) throw redirect(kharchaLinks.signIn(location.href));
		// Narrow the type for child routes: session is non-null below this layout.
		return { session: context.session };
	},
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { kharchaMeQueryOptions } = await import("@/features/kharcha/queries");
		await ensureQuery(context.queryClient, kharchaMeQueryOptions(context.session.user.id));
	},
	// A layout's notFoundComponent replaces the layout, so it brings the shell itself.
	notFoundComponent: KharchaShellNotFound,
	component: KharchaShellLayout,
});
