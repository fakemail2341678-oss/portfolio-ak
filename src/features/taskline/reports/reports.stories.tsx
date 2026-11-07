import type { Meta, StoryObj } from "@storybook/react-vite";
import { Suspense } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ConfirmProvider } from "@/components/dialogs/confirm";
import { m } from "@/paraglide/messages";
import { sampleProjectReports, sampleProjectTasks } from "../../../../.storybook/mocks/taskline";
import CreateProjectDialog from "../projects/create-project-dialog";
import { ProjectUpdates } from "../projects/project-updates";
import { ProjectReportsView } from "./reports-page";

const NOW = Date.parse("2026-10-31T10:00:00.000Z");

/** Task 57: a project's reports, its updates, and "New project" with a template. */
const meta = {
	title: "Taskline/Reports",
	component: ProjectReportsView,
	args: { data: sampleProjectReports, ws: "team", projectKey: "WEB", range: "12w" },
} satisfies Meta<typeof ProjectReportsView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Reports: Story = {
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("heading", { name: m.taskline_report_status_title() })).toBeVisible();
		await expect(canvas.getByTestId("report-time")).toBeVisible();
		await expect(canvas.getByTestId("report-cycle-table")).toBeVisible();
		await expect(canvas.getByTestId("report-range-12w")).toHaveAttribute("aria-current", "true");
		await expect(canvas.getByTestId("report-csv-flow")).toBeEnabled();
	},
};

/** A project that doesn't track time has no time report. */
export const WithoutTime: Story = {
	args: { data: { ...sampleProjectReports, time: null } },
	play: async ({ canvas }) => {
		await expect(canvas.queryByTestId("report-time")).toBeNull();
	},
};

/** No tasks yet: the page says so, and there's nothing to save. */
export const Empty: Story = {
	args: {
		data: {
			...sampleProjectReports,
			statuses: sampleProjectReports.statuses.map((status) => ({ ...status, count: 0 })),
			cycle: { medianLeadDays: null, medianCycleDays: null, p85CycleDays: null, tasks: [] },
			workload: [],
			time: null,
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText(m.taskline_report_empty())).toBeVisible();
		await expect(canvas.getByTestId("report-csv-cycle")).toBeDisabled();
	},
};

/** The overview's updates, for someone who may post. */
export const Updates: Story = {
	render: () => (
		<ConfirmProvider>
			<Suspense>
				<ProjectUpdates userId="story" ws="team" project={sampleProjectTasks.project} now={NOW} />
			</Suspense>
		</ConfirmProvider>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findAllByTestId("project-update")).toHaveLength(2);
		await expect(canvas.getByText(m.taskline_activity_admin())).toBeVisible();
	},
};

/** "New project": choosing a template says what it holds and asks when it starts. */
export const NewProjectFromTemplate: Story = {
	render: () => <CreateProjectDialog ws="team" userId="story" onClose={fn()} />,
	play: async ({ canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		await expect(await body.findByTestId("create-project-dialog")).toBeVisible();
		await userEvent.click(await body.findByRole("combobox", { name: m.taskline_template_field() }));
		await userEvent.click(await body.findByRole("option", { name: "Scrum software" }));
		// The list closes with an animation, and axe reads what is still there when the story ends.
		await waitFor(() => expect(body.queryByRole("listbox")).toBeNull());
		await expect(await body.findByTestId("template-summary")).toBeVisible();
		await expect(body.getByLabelText(m.taskline_template_start())).toBeVisible();
	},
};
