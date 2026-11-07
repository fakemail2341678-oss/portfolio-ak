import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, waitFor } from "storybook/test";
import { stopTasklineTimer } from "../../../../.storybook/mocks/functions/taskline/time";
import { sampleTasklineMember, sampleTimerNav, sampleTimesheet } from "../../../../.storybook/mocks/taskline";
import type { RunningTimer, TimesheetRow } from "../types";
import { formatDuration } from "./duration";
import { TimerPill } from "./timer";
import { TimesheetGrid } from "./timesheet";

/** The timesheet's week with its cells applied to local state, as the page applies them to its query. */
function LiveTimesheet() {
	const [rows, setRows] = useState<TimesheetRow[]>(sampleTimesheet.rows);
	return (
		<TimesheetGrid
			ws="team"
			days={sampleTimesheet.days}
			today={sampleTimesheet.today}
			lockOn={sampleTimesheet.lockOn}
			workingDays={sampleTimesheet.workingDays}
			rows={rows}
			onCell={(changed, day, minutes) =>
				setRows((all) =>
					all.map((row) =>
						row.key === changed.key
							? { ...row, minutes: row.minutes.map((value, index) => (index === day ? minutes : value)) }
							: row,
					),
				)
			}
		/>
	);
}

const meta = {
	title: "Taskline/Time",
	component: LiveTimesheet,
	parameters: { app: { session: sampleTasklineMember } },
} satisfies Meta<typeof LiveTimesheet>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A week from Sunday (the lock, the 25th, is behind it): Saturday is off, days after today and a deleted task's row read only. */
export const Timesheet: Story = {
	play: async ({ canvas }) => {
		await expect(canvas.getAllByTestId("timesheet-row")).toHaveLength(3);
		await expect(canvas.getByTestId("timesheet-total")).toHaveTextContent(formatDuration(810));
	},
};

/** Typing a cell and Enter: the total follows, and the focus goes down a row. */
export const Keyboard: Story = {
	play: async ({ canvas, userEvent }) => {
		const [first] = canvas.getAllByTestId("timesheet-cell");
		if (!first) throw new Error("no cell");
		first.focus();
		await userEvent.keyboard("4{Enter}");
		await waitFor(() => expect(canvas.getByTestId("timesheet-total")).toHaveTextContent(formatDuration(930)));
		await expect(document.activeElement).not.toBe(first);
	},
};

/** The topbar's pill while a timer runs: the task, the time so far, Stop. */
export const Pill: StoryObj<typeof TimerPill> = {
	render: () => (
		<TimerPill
			timer={sampleTimerNav.timer as RunningTimer}
			readAt={sampleTimerNav.readAt}
			userId={sampleTasklineMember.user.id}
		/>
	),
	play: async ({ canvas, userEvent }) => {
		await expect(canvas.getByTestId("timer-pill")).toHaveTextContent("WEB-4");
		await userEvent.click(canvas.getByTestId("timer-pill-stop"));
		await waitFor(() => expect(stopTasklineTimer).toHaveBeenCalled());
	},
};
