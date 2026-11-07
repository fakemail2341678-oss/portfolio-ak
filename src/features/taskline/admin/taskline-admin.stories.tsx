import type { Meta, StoryObj } from "@storybook/react-vite";
import { Suspense } from "react";
import { expect, within } from "storybook/test";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { sampleAdmin } from "../../../../.storybook/mocks/data";
import { sampleAdminReports } from "../../../../.storybook/mocks/functions/taskline-admin/reports";
import { TASKLINE_NAME } from "../brand";
import { TasklineAutomationsPage } from "./automations/automations-page";
import { TasklineFieldsPage } from "./fields/fields-page";
import { TasklineOverviewPage } from "./overview/overview-page";
import { AdminReportsView } from "./reports/reports-page";
import { TasklineSettingsPage } from "./settings/settings-page";
import { TasklineTemplatesPage } from "./templates/templates-page";
import { TasklineWorkflowsPage } from "./workflows/workflows-page";

/** /admin/taskline's pages with the mocked functions (.storybook/mocks/functions/taskline-admin/). */
function Overview() {
	return (
		<Suspense>
			<TasklineOverviewPage />
		</Suspense>
	);
}

const meta = {
	title: "Taskline/Admin",
	component: Overview,
	parameters: { app: { session: sampleAdmin, route: "/admin/taskline" } },
} satisfies Meta<typeof Overview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The team at a glance: the numbers, twelve weeks, each project's health, the people and the sandboxes. */
export const TeamOverview: Story = {
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { level: 1, name: TASKLINE_NAME })).toBeVisible();
		await expect(canvas.getByRole("heading", { name: m.taskline_admin_health_title() })).toBeVisible();
		await expect(canvas.getByRole("link", { name: /Website relaunch/ })).toBeVisible();
	},
};

/** The workspace's settings: name and address, projects, calendar, limits (with what's in use). */
export const Settings: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/taskline/settings" } },
	render: () => (
		<Suspense>
			<TasklineSettingsPage />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByLabelText(m.taskline_admin_workspace_slug())).toHaveValue("team");
		await expect(canvas.getByText(m.taskline_admin_quota_used({ used: formatNumber(96) }))).toBeVisible();
	},
};

/** New projects' statuses, the task types and the team's labels. */
export const Workflows: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/taskline/workflows" } },
	render: () => (
		<Suspense>
			<TasklineWorkflowsPage />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { name: m.taskline_admin_workflows_title() })).toBeVisible();
		await expect(canvas.getByLabelText(m.taskline_admin_label_name_of({ name: "Urgent" }))).toHaveValue("Urgent");
	},
};

/** The team's custom fields (Task 55): a choice on twelve tasks, an archived text field; editing opens the form. */
export const Fields: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/taskline/fields" } },
	render: () => (
		<Suspense>
			<TasklineFieldsPage />
		</Suspense>
	),
	play: async ({ canvas, userEvent }) => {
		await expect(await canvas.findByRole("heading", { name: m.taskline_admin_fields_title() })).toBeVisible();
		await expect(canvas.getAllByTestId("field-row")).toHaveLength(2);
		await expect(canvas.getByText(m.taskline_field_tasks({ count: formatNumber(12) }))).toBeVisible();
		await expect(canvas.getByText(m.taskline_field_archived())).toBeVisible();
		await userEvent.click(canvas.getAllByTestId("field-edit")[0] as HTMLElement);
		const dialog = await within(document.body).findByTestId("field-dialog", {}, { timeout: 25_000 });
		await expect(within(dialog).getByLabelText(m.taskline_field_name())).toHaveValue("Severity");
	},
};

/** The team's templates beside the built-ins (Task 57). */
export const Templates: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/taskline/templates" } },
	render: () => (
		<Suspense>
			<TasklineTemplatesPage />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { name: m.taskline_admin_templates_title() })).toBeVisible();
		await expect(canvas.getAllByTestId("template-row")).toHaveLength(2);
		await expect(canvas.getByTestId("template-copy")).toBeVisible();
		await expect(canvas.getByTestId("template-edit")).toBeVisible();
	},
};

/** Health, workload and time across the team (Task 57). */
export const Reports: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/taskline/reports" } },
	render: () => (
		<Suspense>
			<AdminReportsView data={sampleAdminReports} range="12w" />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { name: m.taskline_admin_reports_title() })).toBeVisible();
		await expect(canvas.getByText("WEB")).toBeVisible();
		await expect(canvas.getByTestId("report-capacity-table")).toBeVisible();
		await expect(canvas.getByTestId("report-time-members")).toBeVisible();
	},
};

/** The team's automations (Task 56): a workspace rule naming only what every project shares, and every team rule's runs. */
export const Automations: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/taskline/automations" } },
	render: () => (
		<Suspense>
			<TasklineAutomationsPage />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { name: m.taskline_admin_automations_title() })).toBeVisible();
		await expect(canvas.getAllByTestId("automation-row")).toHaveLength(1);
		await expect(canvas.getByText(m.taskline_automation_when_due_soon({ days: formatNumber(2) }))).toBeVisible();
		await expect(canvas.getAllByTestId("automation-run")).toHaveLength(3);
	},
};
