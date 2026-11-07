import { createFileRoute, redirect } from "@tanstack/react-router";
import { tasklineLinks } from "@/features/taskline/links";
import { TasklineShellLayout, TasklineShellNotFound } from "@/features/taskline/shell/shell-layout";
import { ensureQuery } from "@/lib/query";

/**
 * Taskline's signed-in app: its shell (sidebar, topbar, palette) around every page.
 * Anyone signed in may enter, a guest too (they have a sandbox); visitors go to
 * Taskline's sign-in with a way back. What each page shows is the server's call
 * (the resolver, decision 0204).
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell")({
	beforeLoad: ({ context, location }) => {
		if (!context.session) throw redirect(tasklineLinks.signIn(location.href));
		// Narrow the type for child routes: session is non-null below this layout.
		return { session: context.session };
	},
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { tasklineNavQueryOptions } = await import("@/features/taskline/queries");
		await ensureQuery(context.queryClient, tasklineNavQueryOptions(context.session.user.id));
	},
	// A layout's notFoundComponent replaces the layout, so it brings the shell itself.
	notFoundComponent: TasklineShellNotFound,
	component: TasklineShellLayout,
});
