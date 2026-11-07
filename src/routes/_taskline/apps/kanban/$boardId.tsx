import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { tasklineLinks } from "@/features/taskline/links";

/**
 * /apps/kanban/$boardId: an old board's address (decision 0210). The board became a
 * project with the same id, so whoever may see it is sent to its board for good (301).
 * Anyone else, or an id that isn't a project, goes to Taskline with a temporary
 * redirect (signing in may change the answer).
 */
export const Route = createFileRoute("/_taskline/apps/kanban/$boardId")({
	beforeLoad: async ({ context, params }) => {
		if (context.session) {
			const { locateTasklineProject } = await import("@/functions/taskline/projects");
			try {
				const { ws, key } = await locateTasklineProject({ data: { id: params.boardId } });
				throw redirect({ ...tasklineLinks.board(ws, key), statusCode: 301 });
			} catch (error) {
				if (isRedirect(error)) throw error;
			}
		}
		throw redirect(tasklineLinks.landing());
	},
});
