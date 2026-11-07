// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TimesheetGrid } from "@/features/taskline/time/timesheet";
import type { TimesheetRow } from "@/features/taskline/types";
import { createPreferencesStore, DEFAULT_PREFERENCES } from "@/lib/stores/preferences";
import type { RouterContext } from "@/router";

/**
 * The timesheet from the keyboard (Task 53): arrows move between open cells (left and
 * right once the caret is at the edge), Enter saves and moves down, Escape puts the
 * value back, a cell saves when left; days after today and on or before the lock date
 * are read only, and so is a row whose task is gone.
 */

const DAYS = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"];
const row = (key: string, ref: string, title: string, minutes: number[], editable = true): TimesheetRow => ({
	key,
	task: { id: key, ref, title, closed: false },
	project: { id: "p", key: "WEB", name: "Website", color: "teal" },
	editable,
	minutes,
});

function Harness({ onCell }: { onCell: (key: string, day: number, minutes: number) => void }) {
	const [rows, setRows] = useState<TimesheetRow[]>([
		row("a", "WEB-1", "Brief", [60, 0, 0, 0, 0, 0, 0]),
		row("b", "WEB-2", "Logo", [0, 30, 0, 0, 0, 0, 0]),
		{ ...row("c", "WEB-3", "Gone", [15, 0, 0, 0, 0, 0, 0], false), task: null },
	]);
	return (
		<TimesheetGrid
			ws="team"
			days={DAYS}
			today="2026-11-04"
			lockOn="2026-11-01"
			workingDays={[0, 1, 2, 3, 4, 5]}
			rows={rows}
			onCell={(changed, day, minutes) => {
				onCell(changed.key, day, minutes);
				setRows((all) =>
					all.map((each) =>
						each.key === changed.key
							? { ...each, minutes: each.minutes.map((value, index) => (index === day ? minutes : value)) }
							: each,
					),
				);
			}}
		/>
	);
}

async function renderGrid(onCell = vi.fn()) {
	const rootRoute = createRootRouteWithContext<Pick<RouterContext, "preferences">>()({ component: Outlet });
	const routeTree = rootRoute.addChildren([
		createRoute({ getParentRoute: () => rootRoute, path: "$", component: () => <Harness onCell={onCell} /> }),
	]);
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ["/app/taskline/team/timesheet"] }),
		context: { preferences: createPreferencesStore(DEFAULT_PREFERENCES) },
	});
	await act(() => router.load());
	render(<RouterProvider router={router} />);
	await screen.findByTestId("timesheet-grid");
	return onCell;
}

const cell = (task: string, day: string) =>
	screen.getByRole("textbox", { name: new RegExp(`^WEB-\\d ${task}, .*${day}`) }) as HTMLInputElement;

describe("the timesheet grid", () => {
	it("opens only today and the days before it after the lock, on rows that may change", async () => {
		await renderGrid();
		// Sunday the 1st is locked, Thursday the 5th on are after today: Monday to Wednesday are open, on two rows.
		expect(screen.getAllByTestId("timesheet-cell")).toHaveLength(6);
		expect(screen.getByTestId("timesheet-total").textContent).toBe("1h 45m");
	});

	it("moves with the arrows, saves on Enter and moves down, and puts a value back on Escape", async () => {
		const user = userEvent.setup();
		const onCell = await renderGrid();
		const first = cell("Brief", "November 2");
		first.focus();
		expect(first.selectionStart).toBe(0);
		await user.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(cell("Brief", "November 3"));
		await user.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(cell("Logo", "November 3"));
		await user.keyboard("{ArrowLeft}");
		expect(document.activeElement).toBe(cell("Logo", "November 2"));
		// Typing replaces the selected value; Logo is the last open row, so Enter saves and stays.
		await user.keyboard("1h 15m{Enter}");
		expect(onCell).toHaveBeenLastCalledWith("b", 1, 75);
		expect(cell("Logo", "November 2").value).toBe("1:15");
		await user.keyboard("{ArrowUp}");
		expect(document.activeElement).toBe(cell("Brief", "November 2"));
		await user.keyboard("2{Enter}");
		expect(onCell).toHaveBeenLastCalledWith("a", 1, 120);
		expect(document.activeElement).toBe(cell("Logo", "November 2"));
		await user.keyboard("9{Escape}");
		expect(cell("Logo", "November 2").value).toBe("1:15");
		expect(onCell).toHaveBeenCalledTimes(2);
	});

	it("marks what isn't a duration and saves nothing", async () => {
		const user = userEvent.setup();
		const onCell = await renderGrid();
		const target = cell("Brief", "November 3");
		target.focus();
		await user.keyboard("soon");
		await user.tab();
		expect(target.getAttribute("aria-invalid")).toBe("true");
		expect(onCell).not.toHaveBeenCalled();
	});
});
