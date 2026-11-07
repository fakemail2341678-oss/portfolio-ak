import type { Meta, StoryObj } from "@storybook/react-vite";
import { ListChecksIcon } from "lucide-react";
import { expect } from "storybook/test";
import { ActivityFeed, Timeline } from "./activity-feed";
import { CopyButton } from "./copy-button";
import { DescriptionList } from "./description-list";
import { RelativeTime } from "./relative-time";
import { StatCard } from "./stat-card";
import { defineStatuses, StatusOf } from "./status-badge";
import { UserAvatar, UserCell } from "./user-avatar";

/** Data display around the stat card: lists of facts, people, times and events. */
const meta = { title: "Data display/Kit", component: DescriptionList } satisfies Meta<typeof DescriptionList>;
export default meta;
type Story = StoryObj<typeof meta>;

const NOW = "2026-10-21T10:00:00.000Z";
const minutesAgo = (minutes: number) => new Date(Date.parse(NOW) - minutes * 60_000).toISOString();

export const Facts: Story = {
	args: {
		items: [
			{ label: "Status", value: "Published" },
			{ label: "Price", value: "रु 1,250" },
			{ label: "Slug", value: "momo-kitchen" },
		],
	},
};

export const Stacked: Story = { args: { ...Facts.args, items: Facts.args?.items ?? [], layout: "stacked" } };

/** A feature declares its statuses once; the badge reads the tone and label from the map. */
export const StatusMap: Story = {
	args: { items: [] },
	render: () => {
		const statuses = defineStatuses<"draft" | "review" | "live">({
			draft: { tone: "neutral", label: () => "Draft" },
			review: { tone: "warning", label: () => "In review" },
			live: { tone: "success", label: () => "Live" },
		});
		return (
			<div className="flex gap-2">
				<StatusOf status="draft" map={statuses} />
				<StatusOf status="review" map={statuses} />
				<StatusOf status="live" map={statuses} />
			</div>
		);
	},
};

export const People: Story = {
	args: { items: [] },
	render: () => (
		<div className="flex max-w-sm flex-col gap-3">
			<UserCell name="Sita Rai" email="sita@example.com" note="(you)" />
			<UserCell name="Ram Thapa" email="ram@example.com" detail="Editor" />
			<div className="flex gap-2">
				<UserAvatar name="Gita Gurung" size="sm" />
				<UserAvatar name="Gita Gurung" />
				<UserAvatar name="Gita Gurung" size="lg" />
			</div>
		</div>
	),
};

/** The server's "now" renders first, so the server and the first browser render agree. */
export const Times: Story = {
	args: { items: [] },
	render: () => (
		<ul className="flex flex-col gap-1 text-sm">
			<li>
				<RelativeTime value={minutesAgo(3)} now={NOW} />
			</li>
			<li>
				<RelativeTime value={minutesAgo(60 * 26)} now={NOW} />
			</li>
		</ul>
	),
	play: async ({ canvas }) => {
		const [first] = canvas.getAllByRole("time");
		await expect(first).toHaveAttribute("datetime", minutesAgo(3));
	},
};

export const Copy: Story = {
	args: { items: [] },
	render: () => (
		<div className="flex items-center gap-2">
			<code className="text-sm">req_7f3a91</code>
			<CopyButton value="req_7f3a91" label="Copy the request id" />
			<CopyButton value="req_7f3a91" label="Copy" showLabel />
		</div>
	),
};

export const Activity: Story = {
	args: { items: [] },
	render: () => (
		<div className="max-w-lg">
			<ActivityFeed
				now={NOW}
				events={[
					{
						id: "1",
						actor: { name: "Sita Rai", email: "sita@example.com" },
						action: "published",
						target: "Momo Kitchen",
						at: minutesAgo(4),
					},
					{
						id: "2",
						actor: { name: "Ram Thapa", email: "ram@example.com" },
						action: "renamed the role",
						target: "Editors",
						at: minutesAgo(90),
					},
				]}
			/>
		</div>
	),
};

export const TimelineWithIcons: Story = {
	args: { items: [] },
	render: () => (
		<div className="max-w-lg">
			<Timeline
				now={NOW}
				items={[
					{
						id: "a",
						marker: <ListChecksIcon aria-hidden />,
						title: "Import finished",
						detail: "30 items",
						at: minutesAgo(10),
					},
					{ id: "b", marker: <ListChecksIcon aria-hidden />, title: "Import started", at: minutesAgo(12) },
				]}
			/>
		</div>
	),
};

/** The trend line takes the delta's colour. */
export const StatWithTrend: Story = {
	args: { items: [] },
	render: () => (
		<div className="grid max-w-2xl gap-3 sm:grid-cols-2">
			<StatCard label="Items" value={42} delta={{ value: 6, label: "this week" }} trend={[3, 5, 4, 7, 8, 12]} />
			<StatCard label="Errors" value={3} delta={{ value: -2, label: "this week" }} trend={[9, 7, 6, 5, 4, 3]} />
		</div>
	),
};
