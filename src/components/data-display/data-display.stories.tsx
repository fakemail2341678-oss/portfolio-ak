import type { Meta, StoryObj } from "@storybook/react-vite";
import { DatabaseIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { expect } from "storybook/test";
import { StatCard } from "./stat-card";
import { StatusBadge } from "./status-badge";

const meta = {
	title: "Data display/Stat card",
	component: StatCard,
	args: { label: "Items", value: 1280, icon: DatabaseIcon },
} satisfies Meta<typeof StatCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {};

/** A rise is green, a fall red, no change muted; the word says which, not only the colour. */
export const WithDeltas: Story = {
	render: () => (
		<div className="grid gap-3 sm:grid-cols-3">
			<StatCard
				label="Items"
				value={30}
				icon={DatabaseIcon}
				delta={{ value: 4, label: "this week" }}
				hint="20 published"
			/>
			<StatCard label="Users" value={128} icon={UsersIcon} delta={{ value: -2, label: "this week" }} hint="2 banned" />
			<StatCard label="Roles" value={4} icon={ShieldCheckIcon} delta={{ value: 0, label: "this week" }} />
		</div>
	),
	play: async ({ canvas }) => {
		// Signed numbers in the story's locale (Devanagari digits in the Nepali pass).
		await expect(canvas.getAllByText(/this week/)).toHaveLength(3);
		await expect(canvas.getByText(/this week/, { selector: ".text-success" })).toBeVisible();
		await expect(canvas.getByText(/this week/, { selector: ".text-danger" })).toBeVisible();
	},
};

/** With `to`, the whole card is one link. */
export const AsLink: Story = { args: { to: "/admin/test-crud" } };

export const StatusBadges: Story = {
	render: () => (
		<div className="flex flex-wrap gap-2">
			<StatusBadge>Draft</StatusBadge>
			<StatusBadge tone="success">Published</StatusBadge>
			<StatusBadge tone="warning">Pending</StatusBadge>
			<StatusBadge tone="info">Scheduled</StatusBadge>
			<StatusBadge tone="danger">Banned</StatusBadge>
		</div>
	),
};
