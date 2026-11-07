// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Calendar } from "@/features/taskline/calendar/calendar";
import { calendarWeeks } from "@/features/taskline/calendar/grid";
import type { TasklineStatus, TaskSummary } from "@/features/taskline/types";

/**
 * Taskline's calendar from the keyboard (Task 51): Alt + left and right move a task a
 * day, Alt + up and down a week; an undated task is scheduled on the day shown. Each
 * move is announced and the focus follows the task. A reader gets no handles.
 */
const STATUSES: TasklineStatus[] = [
	{ id: "todo", name: "To do", category: "unstarted", color: "gray", position: "a0", wipLimit: null },
];
const task = (id: string, title: string, dueOn: string | null): TaskSummary => ({
	id,
	ref: `WEB-${id.length}`,
	number: id.length,
	type: "task",
	title,
	statusId: "todo",
	priority: 0,
	assigneeId: null,
	parentId: null,
	labelIds: [],
	position: "a0",
	startOn: null,
	dueOn,
	completedAt: null,
	checklist: { done: 0, total: 0 },
	updatedAt: "2026-11-01T00:00:00.000Z",
	sprintId: null,
	points: null,
	rank: "c000",
	estimateMinutes: null,
	milestoneId: null,
	blocked: false,
	fields: {},
	recurrence: null,
});

function Harness({ canEdit = true }: { canEdit?: boolean }) {
	const [tasks, setTasks] = useState([task("a", "Brief", "2026-11-04"), task("bb", "Logo", null)]);
	return (
		<Calendar
			weeks={calendarWeeks("2026-11-04", "month", 0)}
			month="2026-11"
			today="2026-11-04"
			anchor="2026-11-10"
			workingDays={[0, 1, 2, 3, 4, 5]}
			tasks={tasks}
			dayOf={(each) => each.dueOn}
			statuses={STATUSES}
			canEdit={canEdit}
			onMove={(moved, day) =>
				setTasks((all) => all.map((each) => (each.id === moved.id ? { ...each, dueOn: day } : each)))
			}
			renderOpen={(_task, children) => children}
		/>
	);
}

const dayCell = (day: string) => {
	const cell = document.querySelector<HTMLElement>(`[data-day="${day}"]`);
	if (!cell) throw new Error(`no ${day}`);
	return cell;
};

describe("the calendar", () => {
	it("moves a task a day or a week with Alt and the arrows, announces it, and keeps the focus on it", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		expect(within(dayCell("2026-11-04")).getByText("Brief")).toBeTruthy();
		screen.getByRole("button", { name: "Reschedule Brief" }).focus();
		await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
		expect(within(dayCell("2026-11-05")).getByText("Brief")).toBeTruthy();
		expect(screen.getByTestId("taskline-announcement").textContent).toContain("Brief moved to");
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reschedule Brief" }));
		await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
		expect(within(dayCell("2026-11-12")).getByText("Brief")).toBeTruthy();
		await user.keyboard("{Alt>}{ArrowUp}{/Alt}{Alt>}{ArrowLeft}{/Alt}");
		expect(within(dayCell("2026-11-04")).getByText("Brief")).toBeTruthy();
	});

	it("lists undated tasks beside the month and schedules one on the day shown", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		const undated = screen.getByTestId("calendar-undated");
		expect(within(undated).getByText("Logo")).toBeTruthy();
		within(undated).getByRole("button", { name: "Reschedule Logo" }).focus();
		await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
		expect(within(dayCell("2026-11-10")).getByText("Logo")).toBeTruthy();
		expect(within(screen.getByTestId("calendar-undated")).queryByText("Logo")).toBeNull();
	});

	it("gives a reader no handles", () => {
		render(<Harness canEdit={false} />);
		expect(screen.queryAllByRole("button", { name: /Reschedule/ })).toEqual([]);
		expect(screen.getByText("Brief")).toBeTruthy();
	});
});
