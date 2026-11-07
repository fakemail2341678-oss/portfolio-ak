import { createFileRoute, redirect } from "@tanstack/react-router";
import { tasklineLinks } from "@/features/taskline/links";

/** /apps/kanban: Kanban became Taskline (decision 0210), so its address redirects there for good. */
export const Route = createFileRoute("/_taskline/apps/kanban/")({
	beforeLoad: () => {
		throw redirect({ ...tasklineLinks.landing(), statusCode: 301 });
	},
});
