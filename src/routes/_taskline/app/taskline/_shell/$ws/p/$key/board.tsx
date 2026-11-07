import { createFileRoute } from "@tanstack/react-router";
import { BoardPage } from "@/features/taskline/board/board-page";
import { tasklineTitle } from "@/features/taskline/brand";
import { boardSearch } from "@/features/taskline/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { listSearch } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

/**
 * /app/taskline/$ws/p/$key/board: the project's statuses as columns (the layout loaded
 * the tasks). The filters and swimlanes are in the URL; `?task=` opens a task in a
 * sheet, masked as its own page.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/board")({
	...listSearch(boardSearch, boardSearch.parse({})),
	staticData: { breadcrumb: staticCrumb(m.taskline_view_board) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_view_board()) }] }),
	component: BoardPage,
});
