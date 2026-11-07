// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { timelineGroups, timelineRange } from "@/features/taskline/timeline/layout";
import { Timeline } from "@/features/taskline/timeline/timeline";
import type { Milestone, TaskSummary } from "@/features/taskline/types";

/**
 * Taskline's timeline from the keyboard (Task 54): Alt + ← → moves a task's bar a day,
 * Alt + Shift + ← → changes its last day; a task without dates is scheduled on the day
 * shown. Each change is announced and the focus stays on the bar. Conflicts and blocked
 * tasks are marked; the hidden table says the same. A reader gets no bars to move.
 */
const task = (id: string, title: string, values: Partial<TaskSummary> = {}): TaskSummary => ({
	id,
	ref: `WEB-${id}`,
	number: Number(id),
	type: "task",
	title,
	statusId: "todo",
	priority: 0,
	assigneeId: null,
	parentId: null,
	labelIds: [],
	position: "a0",
	startOn: null,
	dueOn: null,
	completedAt: null,
	checklist: { done: 0, total: 0 },
	updatedAt: "2026-11-01T00:00:00.000Z",
	sprintId: null,
	points: null,
	rank: "a0",
	estimateMinutes: null,
	milestoneId: null,
	blocked: false,
	fields: {},
	recurrence: null,
	...values,
});

const MILESTONES: Milestone[] = [
	{ id: "ms", name: "Launch", description: "", dueOn: "2026-11-12", completedAt: null, position: "a0" },
];

function Harness({ canEdit = true }: { canEdit?: boolean }) {
	const [tasks, setTasks] = useState([
		task("1", "Brief", { startOn: "2026-11-02", dueOn: "2026-11-05" }),
		task("2", "Build", { startOn: "2026-11-04", dueOn: "2026-11-09", blocked: true }),
		task("3", "Logo"),
	]);
	return (
		<Timeline
			range={timelineRange("2026-11-04", "day", 0)}
			today="2026-11-04"
			anchor="2026-11-10"
			weekStart={0}
			workingDays={[0, 1, 2, 3, 4, 5]}
			groups={timelineGroups(tasks, "none", { milestones: MILESTONES, members: [] }).map((group) => ({
				...group,
				label: null,
			}))}
			milestones={MILESTONES}
			dependencies={[{ blockerId: "1", blockedId: "2" }]}
			allTasks={tasks}
			canEdit={canEdit}
			onChange={(changed, dates) =>
				setTasks((all) => all.map((each) => (each.id === changed.id ? { ...each, ...dates } : each)))
			}
			onOpen={() => {}}
			renderOpen={(_task, children) => children}
		/>
	);
}

const bar = (ref: string) => {
	const found = screen.getAllByTestId("timeline-bar").find((each) => each.getAttribute("aria-label")?.includes(ref));
	if (!found) throw new Error(`no bar for ${ref}`);
	return found;
};

describe("the timeline", () => {
	it("moves a bar a day and changes its last day from the keyboard, announced, keeping the focus", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		bar("WEB-1").focus();
		await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
		expect(bar("WEB-1").dataset).toMatchObject({ start: "2026-11-03", end: "2026-11-06" });
		expect(screen.getByTestId("taskline-announcement").textContent).toContain("WEB-1 Brief now runs from");
		expect(document.activeElement).toBe(bar("WEB-1"));
		await user.keyboard("{Alt>}{Shift>}{ArrowRight}{ArrowRight}{/Shift}{/Alt}");
		expect(bar("WEB-1").dataset).toMatchObject({ start: "2026-11-03", end: "2026-11-08" });
		await user.keyboard("{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}{Alt>}{ArrowLeft}{/Alt}");
		expect(bar("WEB-1").dataset).toMatchObject({ start: "2026-11-02", end: "2026-11-06" });
	});

	it("schedules a task without dates on the day shown", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		expect(bar("WEB-3").getAttribute("aria-label")).toContain("no dates");
		bar("WEB-3").focus();
		await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
		expect(bar("WEB-3").dataset).toMatchObject({ start: "2026-11-10", end: "2026-11-10" });
	});

	it("marks a blocked task and one that starts before its blocker ends, in the drawing and the table", () => {
		render(<Harness />);
		expect(screen.getAllByTestId("timeline-blocked")).toHaveLength(1);
		expect(screen.getAllByTestId("timeline-clash")).toHaveLength(1);
		expect(document.querySelector('[data-testid="timeline-arrow"][data-conflict="true"]')).not.toBeNull();
		expect(screen.getByTestId("timeline-milestone").getAttribute("title")).toContain("Launch");
		const table = screen.getAllByRole("table")[0];
		expect(table?.textContent).toContain("Starts before WEB-1 ends");
	});

	it("gives a reader no bars to move", () => {
		render(<Harness canEdit={false} />);
		expect(screen.queryAllByRole("button", { name: /Reschedule|Schedule/ })).toEqual([]);
		expect(screen.getAllByTestId("timeline-bar")).toHaveLength(2);
	});
});
