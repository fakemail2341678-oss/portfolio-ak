import { createFileRoute, redirect } from "@tanstack/react-router";
import { tasklineLinks } from "@/features/taskline/links";

/** /app/taskline/$ws/p/$key/settings opens on its first section. */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/settings/")({
	beforeLoad: ({ params }) => {
		throw redirect({ ...tasklineLinks.settings(params.ws, params.key, "general"), replace: true });
	},
});
