import { createFileRoute, redirect } from "@tanstack/react-router";

/** /admin/chaal: the lab until the overview arrives (Task 84). The lab checks chaal:configure itself. */
export const Route = createFileRoute("/_admin/admin/chaal/")({
	beforeLoad: () => {
		throw redirect({ to: "/admin/chaal/lab" });
	},
});
