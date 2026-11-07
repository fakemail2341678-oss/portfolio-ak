import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor, within } from "storybook/test";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import {
	sampleAutomationRuns,
	sampleAutomations,
	sampleProjectTasks,
	sampleTasklineMember,
} from "../../../../.storybook/mocks/taskline";
import { AutomationRuns } from "./automation-runs";
import { AutomationsEditor, type AutomationWrites } from "./automations-editor";
import type { AutomationOptions } from "./describe";

const options: AutomationOptions = {
	scope: "project",
	statuses: sampleProjectTasks.statuses,
	labels: sampleProjectTasks.labels,
	members: sampleProjectTasks.members,
	fields: sampleProjectTasks.fields,
	sprints: sampleProjectTasks.sprints,
};

const writes: AutomationWrites = {
	create: fn(async () => undefined),
	update: fn(async () => undefined),
	toggle: fn(async () => undefined),
	remove: fn(async () => undefined),
	preview: { queryKey: ["story", "automation-preview"], run: fn(async () => ({ count: 4, capped: false })) },
};

const NOW = Date.parse("2026-10-31T10:00:00.000Z");

/** A project's automations (Task 56) as its lead's settings show them: the rules, then the run log. */
function ProjectAutomations() {
	return (
		<div className="flex flex-col gap-8">
			<AutomationsEditor automations={sampleAutomations} options={options} writes={writes} now={NOW} />
			<AutomationRuns runs={sampleAutomationRuns} ws="team" now={NOW} />
		</div>
	);
}

const meta = {
	title: "Taskline/Automations",
	component: ProjectAutomations,
	parameters: { app: { session: sampleTasklineMember } },
} satisfies Meta<typeof ProjectAutomations>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Each rule as a sentence with its last run, one switched off; the log says what came of each run. */
export const Rules: Story = {
	play: async ({ canvas, userEvent }) => {
		await expect(canvas.getAllByTestId("automation-row")).toHaveLength(2);
		await expect(canvas.getByText(m.taskline_automation_when_status({ status: "Done" }))).toBeVisible();
		await expect(canvas.getByText(m.taskline_automation_off())).toBeVisible();
		await expect(canvas.getAllByTestId("automation-run")).toHaveLength(3);
		await expect(canvas.getByText(m.taskline_automation_run_conditions())).toBeVisible();
		await expect(canvas.getByText(m.taskline_automation_run_no_task())).toBeVisible();
		await userEvent.click(canvas.getAllByTestId("automation-toggle")[1] as HTMLElement);
		await waitFor(() => expect(writes.toggle).toHaveBeenCalledWith({ id: sampleAutomations[1]?.id, enabled: true }));
	},
};

/** The builder, from a rule: when, if, then, with the open tasks its conditions match now; saving keeps its version. */
export const Builder: Story = {
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getAllByTestId("automation-edit")[0] as HTMLElement);
		const dialog = within(await within(document.body).findByTestId("automation-dialog", {}, { timeout: 25_000 }));
		await expect(dialog.getByLabelText(m.taskline_automation_name())).toHaveValue("Ship bugs");
		await expect(
			await dialog.findByText(m.taskline_automation_preview({ count: formatNumber(4) }), {}, { timeout: 5_000 }),
		).toBeVisible();
		await expect(dialog.getAllByRole("checkbox", { checked: true }).length).toBeGreaterThan(0);
		await userEvent.click(dialog.getByRole("button", { name: m.crud_save() }));
		await waitFor(() =>
			expect(writes.update).toHaveBeenCalledWith(expect.objectContaining({ id: sampleAutomations[0]?.id, version: 2 })),
		);
	},
};
