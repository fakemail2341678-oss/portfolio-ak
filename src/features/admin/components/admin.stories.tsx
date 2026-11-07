import type { Meta, StoryObj } from "@storybook/react-vite";
import { Suspense } from "react";
import { expect } from "storybook/test";
import { m } from "@/paraglide/messages";
import { sampleAdmin, sampleEditor } from "../../../../.storybook/mocks/data";
import { AppearanceSettings } from "./appearance-settings";
import { Dashboard } from "./dashboard";

/** The admin home with the mocked getDashboard (.storybook/mocks/functions/admin.ts). */
function DashboardPage() {
	return (
		<Suspense>
			<Dashboard />
		</Suspense>
	);
}

const meta = {
	title: "Admin/Dashboard",
	component: DashboardPage,
	parameters: { app: { session: sampleAdmin, route: "/admin" } },
} satisfies Meta<typeof DashboardPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Totals, the latest audit events and the quick actions. */
export const ForAnAdmin: Story = {
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { level: 1, name: m.admin_nav_dashboard() })).toBeVisible();
		await expect(canvas.getByRole("link", { name: m.admin_nav_users() })).toBeVisible();
		await expect(canvas.getByRole("link", { name: m.command_test_crud_new() })).toBeVisible();
		await expect(canvas.getByRole("heading", { name: m.dashboard_activity_title() })).toBeVisible();
	},
};

/** An editor's quick actions: only what they may run (the mock still returns every number). */
export const ForAnEditor: Story = { parameters: { app: { session: sampleEditor, route: "/admin" } } };

/** /admin/settings/appearance: every choice applies at once, the preview shows it. */
export const Appearance: Story = {
	parameters: { app: { session: sampleAdmin, route: "/admin/settings/appearance" } },
	render: () => <AppearanceSettings />,
	play: async ({ canvas, userEvent }) => {
		const rose = canvas.getByRole("radio", { name: m.appearance_accent_rose() });
		await userEvent.click(rose);
		await expect(rose).toBeChecked();
		// Back to the default, so the next story starts from it.
		await userEvent.click(canvas.getByRole("radio", { name: m.appearance_accent_indigo() }));
	},
};
