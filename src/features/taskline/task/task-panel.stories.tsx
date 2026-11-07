import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor, within } from "storybook/test";
import { m } from "@/paraglide/messages";
import { patchTasklineTask } from "../../../../.storybook/mocks/functions/taskline/tasks";
import { logTasklineTime } from "../../../../.storybook/mocks/functions/taskline/time";
import { removeTasklineDependency } from "../../../../.storybook/mocks/functions/taskline/timeline";
import {
	FIELD_REVIEWER,
	FIELD_SEVERITY,
	FIELD_SIGNED_OFF,
	sampleProjectTasks,
	sampleTaskDetail,
	sampleTasklineMember,
} from "../../../../.storybook/mocks/taskline";
import { recurrenceText } from "../automations/recurrence-text";
import { formatDuration } from "../time/duration";
import type { Recurrence } from "../types";
import { TaskPanel } from "./task-panel";

/** The task, as the sheet over a view and its own page show it (Task 48). */
const meta = {
	title: "Taskline/Task",
	component: TaskPanel,
	args: {
		task: sampleTaskDetail,
		project: sampleProjectTasks,
		userId: sampleTasklineMember.user.id,
		ws: "team",
		variant: "page",
		onTrashed: fn(),
	},
	parameters: { app: { session: sampleTasklineMember } },
} satisfies Meta<typeof TaskPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Its fields, the versioned title and description, the checklist and subtasks; a field change saves at once. */
export const Editing: Story = {
	play: async ({ canvas, userEvent }) => {
		await expect(canvas.getByLabelText(m.taskline_field_title())).toHaveValue("Fix the broken contact form");
		await expect(canvas.getByTestId("task-status")).toHaveValue("st-doing");
		await expect(canvas.getByTestId("task-checklist")).toHaveTextContent("Reproduce it on a phone");
		await userEvent.selectOptions(canvas.getByTestId("task-priority"), "3");
		await waitFor(() =>
			expect(patchTasklineTask).toHaveBeenCalledWith({ data: { ws: "team", ref: "WEB-4", priority: 3 } }),
		);
	},
};

/** Its history, as sentences. */
export const Activity: Story = {
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByTestId("task-tab-activity"));
		await expect(canvas.getByTestId("task-activity")).toHaveTextContent("Bikash Thapa");
	},
};

/** Its conversation (Task 50): a mention, an edited comment of one's own, and watching. */
export const Conversation: Story = {
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByTestId("task-tab-comments"));
		await expect(canvas.getAllByTestId("task-comment")).toHaveLength(2);
		await expect(canvas.getByTestId("task-comments")).toHaveTextContent("@Asha Gurung");
		await expect(canvas.getByTestId("task-watch")).toHaveAttribute("aria-pressed", "true");
	},
};

/** A viewer reads it: no form, no trash. */
export const ReadOnly: Story = {
	args: {
		task: { ...sampleTaskDetail, can: { view: true, comment: true, edit: false, manage: false, logTime: false } },
	},
	play: async ({ canvas }) => {
		await expect(canvas.queryByTestId("task-form")).toBeNull();
		await expect(canvas.queryByTestId("task-trash")).toBeNull();
		await expect(canvas.getByTestId("task-priority")).toBeDisabled();
	},
};

/** Its time (Task 53): logged against the estimate, the entries (one's own to change), logging by hand, the timer. */
export const Time: Story = {
	play: async ({ canvas, userEvent }) => {
		await expect(canvas.getByTestId("task-estimate")).toHaveValue("6:00");
		await expect(canvas.getByTestId("task-timer-start")).toBeVisible();
		await userEvent.click(canvas.getByTestId("task-tab-time"));
		await expect(canvas.getByTestId("time-against-estimate")).toHaveTextContent(formatDuration(270));
		await expect(canvas.getAllByTestId("time-entry")).toHaveLength(2);
		await userEvent.click(canvas.getByTestId("time-log-open"));
		await userEvent.type(canvas.getByTestId("time-duration"), "45m");
		await userEvent.click(canvas.getByTestId("time-submit"));
		await waitFor(() =>
			expect(logTasklineTime).toHaveBeenCalledWith({
				data: expect.objectContaining({ ws: "team", ref: "WEB-4", minutes: 45 }),
			}),
		);
	},
};

/** Its dependencies (Task 54): blocked by an open task, the project's rule said, one in another project; a removal. */
export const Dependencies: Story = {
	play: async ({ canvas, userEvent }) => {
		const section = within(canvas.getByTestId("task-dependencies"));
		await expect(section.getByTestId("task-blocked_by")).toHaveTextContent("WEB-2");
		await expect(section.getByTestId("task-blocks")).toHaveTextContent("Operations");
		await expect(section.getByTestId("task-blocked-rule")).toBeVisible();
		await expect(canvas.getByTestId("task-milestone")).toBeVisible();
		await userEvent.click(section.getByRole("button", { name: m.taskline_dependencies_remove({ task: "OPS-3" }) }));
		await waitFor(() =>
			expect(removeTasklineDependency).toHaveBeenCalledWith({
				data: { ws: "team", ref: "WEB-4", relation: "blocks", other: "OPS-3" },
			}),
		);
	},
};

/** Its custom fields (Task 55): a workspace choice, a person, a required box still empty; a choice saves at once. */
export const CustomFields: Story = {
	args: { task: { ...sampleTaskDetail, fields: { [FIELD_SEVERITY]: "omed001", [FIELD_REVIEWER]: "m-sita" } } },
	play: async ({ canvas, userEvent }) => {
		const section = within(canvas.getByTestId("task-custom-fields"));
		await expect(section.getByLabelText("Severity")).toHaveValue("omed001");
		await expect(section.getByText(m.taskline_field_needed())).toBeVisible();
		await userEvent.selectOptions(section.getByLabelText("Severity"), "ohigh01");
		await waitFor(() =>
			expect(patchTasklineTask).toHaveBeenCalledWith({
				data: { ws: "team", ref: "WEB-4", fields: { [FIELD_SEVERITY]: "ohigh01" } },
			}),
		);
		await expect(section.getByRole("checkbox")).toHaveAttribute("id", expect.stringContaining(FIELD_SIGNED_OFF));
	},
};

const weekly: Recurrence = { freq: "weekly", interval: 1, weekdays: [0, 3], anchor: "2026-11-01", n: 1 };

/** Its repeat (Task 56): how it repeats, and the dialog that changes it; saving sends the rule. */
export const Repeat: Story = {
	args: { task: { ...sampleTaskDetail, recurrence: weekly } },
	play: async ({ canvas, userEvent }) => {
		const field = within(canvas.getByTestId("task-repeat"));
		await expect(field.getByText(recurrenceText(weekly))).toBeVisible();
		await userEvent.click(field.getByTestId("task-repeat-edit"));
		const dialog = within(await within(document.body).findByTestId("recurrence-dialog", {}, { timeout: 25_000 }));
		await userEvent.click(dialog.getByRole("button", { name: m.crud_save() }));
		await waitFor(() =>
			expect(patchTasklineTask).toHaveBeenCalledWith({
				data: { ws: "team", ref: "WEB-4", recurrence: { freq: "weekly", interval: 1, weekdays: [0, 3] } },
			}),
		);
	},
};
