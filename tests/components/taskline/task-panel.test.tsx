// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmProvider } from "@/components/dialogs/confirm";
import { TaskPanel } from "@/features/taskline/task/task-panel";
import type { TaskDetail } from "@/features/taskline/types";
import { createPreferencesStore, DEFAULT_PREFERENCES } from "@/lib/stores/preferences";
import type { RouterContext } from "@/router";
import { sampleProjectTasks, sampleTaskDetail } from "../../../.storybook/mocks/taskline";

/**
 * The task's fields (Task 48, decision 0211): each change goes to the server at once
 * (a status by `moveTask`, at the end of the new status; the rest by `patchTask`; the
 * checklist by `setChecklist`), and a reader gets them read-only. The functions modules
 * are replaced: they import server code that only Start's compiler strips.
 */
const calls = vi.hoisted(() => ({ patch: vi.fn(), move: vi.fn(), checklist: vi.fn(), watch: vi.fn() }));
vi.mock("@/functions/taskline/tasks", () => ({
	patchTasklineTask: async (options: unknown) => calls.patch(options),
	moveTasklineTask: async (options: unknown) => calls.move(options),
	setTasklineChecklist: async (options: unknown) => calls.checklist(options),
}));
vi.mock("@/functions/taskline/projects", () => ({}));
vi.mock("@/functions/taskline/workflow", () => ({}));
vi.mock("@/functions/taskline/workspaces", () => ({}));
vi.mock("@/functions/taskline/home", () => ({}));
vi.mock("@/functions/taskline/collab", () => ({
	watchTasklineTask: async (options: unknown) => calls.watch(options),
	getTasklineUploadSettings: async () => ({ enabled: false }),
}));
vi.mock("@/functions/taskline/inbox", () => ({}));
vi.mock("@/functions/attachments", () => ({}));

async function renderPanel(task: TaskDetail) {
	const page = () => (
		<ConfirmProvider>
			<TaskPanel
				task={task}
				project={sampleProjectTasks}
				userId="asha-1"
				ws="team"
				variant="sheet"
				onTrashed={vi.fn()}
			/>
		</ConfirmProvider>
	);
	const rootRoute = createRootRouteWithContext<Pick<RouterContext, "preferences">>()({ component: Outlet });
	const routeTree = rootRoute.addChildren([
		createRoute({ getParentRoute: () => rootRoute, path: "$", component: page }),
	]);
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ["/app/taskline/team/p/WEB/board"] }),
		context: { preferences: createPreferencesStore(DEFAULT_PREFERENCES) },
	});
	await act(() => router.load());
	render(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	return screen.findByTestId("task-panel");
}

beforeEach(() => {
	for (const call of Object.values(calls)) call.mockReset().mockResolvedValue(sampleTaskDetail);
});

describe("the task's fields", () => {
	it("saves a priority, an assignee and a type at once", async () => {
		const user = userEvent.setup();
		await renderPanel(sampleTaskDetail);
		await user.selectOptions(screen.getByTestId("task-priority"), "3");
		expect(calls.patch).toHaveBeenLastCalledWith({ data: { ws: "team", ref: "WEB-4", priority: 3 } });
		await user.selectOptions(screen.getByTestId("task-assignee"), "");
		expect(calls.patch).toHaveBeenLastCalledWith({ data: { ws: "team", ref: "WEB-4", assigneeId: null } });
		await user.selectOptions(screen.getByTestId("task-type"), "story");
		expect(calls.patch).toHaveBeenLastCalledWith({ data: { ws: "team", ref: "WEB-4", type: "story" } });
	});

	it("moves it to the end of another status", async () => {
		const user = userEvent.setup();
		await renderPanel(sampleTaskDetail);
		await user.selectOptions(screen.getByTestId("task-status"), "st-done");
		// "Done" holds one task at a0: the moved one goes after it.
		expect(calls.move).toHaveBeenCalledWith({
			data: { ws: "team", ref: "WEB-4", statusId: "st-done", position: "a1" },
		});
	});

	it("ticks a checklist item", async () => {
		const user = userEvent.setup();
		await renderPanel(sampleTaskDetail);
		const checklist = screen.getByTestId("task-checklist");
		await user.click(within(checklist).getByRole("checkbox", { name: "Done: Read the server logs" }));
		const sent = calls.checklist.mock.calls.at(-1)?.[0] as {
			data: { checklist: Array<{ text: string; done: boolean }> };
		};
		expect(sent.data.checklist.find((item) => item.text === "Read the server logs")?.done).toBe(true);
	});

	it("shows the conversation, and watches or stops watching (Task 50)", async () => {
		const user = userEvent.setup();
		await renderPanel(sampleTaskDetail);
		await user.click(screen.getByTestId("task-tab-comments"));
		const comments = screen.getAllByTestId("task-comment");
		expect(comments).toHaveLength(2);
		// Someone else's comment: the lead may delete it, not edit it; their own: both.
		expect(within(comments[0] as HTMLElement).queryByRole("button", { name: /edit/i })).toBeNull();
		expect(within(comments[1] as HTMLElement).getByRole("button", { name: /edit/i })).toBeVisible();
		const watch = screen.getByTestId("task-watch");
		expect(watch).toHaveAttribute("aria-pressed", "true");
		await user.click(watch);
		expect(calls.watch).toHaveBeenCalledWith({ data: { ws: "team", ref: "WEB-4", watching: false } });
	});

	it("is read-only for someone who may not edit", async () => {
		await renderPanel({
			...sampleTaskDetail,
			can: { view: true, comment: true, edit: false, manage: false, logTime: false },
		});
		expect(screen.queryByTestId("task-form")).toBeNull();
		expect(screen.queryByTestId("task-status")).toBeNull();
		expect(screen.getByTestId("task-priority")).toBeDisabled();
		expect(screen.queryByTestId("task-trash")).toBeNull();
	});
});
