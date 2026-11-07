import { createFileRoute, redirect } from "@tanstack/react-router";
import { tasklineLinks } from "@/features/taskline/links";

/** /app/taskline/$ws (the breadcrumb links here): a workspace opens on its projects. */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/")({
	beforeLoad: ({ params }) => {
		throw redirect({ ...tasklineLinks.projects(params.ws), replace: true });
	},
});
