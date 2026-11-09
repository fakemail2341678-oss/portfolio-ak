import { createFileRoute, redirect } from "@tanstack/react-router";

/** /admin/chaal: the settings until the overview arrives (Task 84). Every Chaal admin page needs chaal:read. */
export const Route = createFileRoute("/_admin/admin/chaal/")({
	beforeLoad: () => {
		throw redirect({ to: "/admin/chaal/settings" });
	},
});
