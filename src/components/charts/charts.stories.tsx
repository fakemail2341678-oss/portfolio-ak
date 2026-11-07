import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { AreaChart, BarChart, DonutChart, LineChart, Sparkline } from "./index";

const week = [
	{ day: "Mon", created: 4, done: 2 },
	{ day: "Tue", created: 7, done: 5 },
	{ day: "Wed", created: 5, done: 4 },
	{ day: "Thu", created: 9, done: 6 },
	{ day: "Fri", created: 12, done: 9 },
];
const series = [
	{ key: "created", label: "Created" },
	{ key: "done", label: "Done" },
];

/** Charts load Recharts on demand; the frame keeps its size meanwhile and a table carries the numbers. */
const meta = {
	title: "Data display/Charts",
	component: AreaChart,
	args: { label: "Tasks this week", data: week, index: "day", series },
	// Charts fill their container's width: give the story one.
	decorators: [
		(Story) => (
			<div className="w-[36rem] max-w-full">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof AreaChart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Area: Story = {
	// Loads the Recharts chunk before rendering: under a full parallel run, the first import of it
	// can outlast the play function's wait.
	loaders: [async () => ({ chart: await import("./cartesian-chart") })],
	play: async ({ canvasElement }) => {
		// The screen-reader table is there at once; the chart follows when Recharts has loaded.
		await expect(canvasElement.querySelector("table caption")).toHaveTextContent("Tasks this week");
		// Recharts' own SVG needs a measured size, which a background test iframe may not have:
		// check that the lazy chart mounted in place of the skeleton.
		await waitFor(() => expect(canvasElement.querySelector('[data-slot="chart"]')).not.toBeNull(), { timeout: 10_000 });
	},
};

export const StackedArea: Story = { args: { stacked: true } };

export const Bars: Story = { render: (args) => <BarChart {...args} /> };

/** Lines with a dashed guide and a gap where a row has no value (a burndown: the days still to come). */
export const Lines: Story = {
	render: (args) => (
		<LineChart
			{...args}
			label="Work remaining each day"
			data={[
				{ day: "Mon", remaining: 12, ideal: 12 },
				{ day: "Tue", remaining: 10, ideal: 9 },
				{ day: "Wed", remaining: 7, ideal: 6 },
				{ day: "Thu", remaining: null, ideal: 3 },
				{ day: "Fri", remaining: null, ideal: 0 },
			]}
			series={[
				{ key: "remaining", label: "Remaining" },
				{ key: "ideal", label: "Ideal", dashed: true, color: "var(--muted-foreground)" },
			]}
		/>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelector("table caption")).toHaveTextContent("Work remaining each day");
		await expect(canvasElement.querySelector("tbody tr:last-child td")).toHaveTextContent("–");
	},
};

export const Donut: Story = {
	render: () => (
		<div className="w-64">
			<DonutChart
				label="Items by status"
				index="status"
				series={[{ key: "count", label: "Items" }]}
				data={[
					{ status: "Published", count: 20 },
					{ status: "Draft", count: 10 },
				]}
			/>
		</div>
	),
};

export const Sparklines: Story = {
	render: () => (
		<div className="flex max-w-xs flex-col gap-3">
			<Sparkline values={[3, 5, 4, 7, 8, 12]} />
			<Sparkline values={[9, 7, 6, 5, 4, 3]} tone="danger" />
		</div>
	),
};
