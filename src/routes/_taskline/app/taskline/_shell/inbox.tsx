import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { InboxPage } from "@/features/taskline/inbox/inbox-page";
import { inboxSearch } from "@/features/taskline/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /app/taskline/inbox: the caller's notifications, unread or all (Task 50). */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/inbox")({
	validateSearch: inboxSearch,
	// The defaults (unread, the first page) stay out of links.
	search: { middlewares: [stripSearchParams({ filter: "unread", page: 1 })] },
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const { inboxQueryOptions } = await import("@/features/taskline/queries");
		await ensureQuery(context.queryClient, inboxQueryOptions(context.session.user.id, deps));
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_inbox) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_inbox()) }] }),
	component: InboxPage,
});
