import type { Meta, StoryObj } from "@storybook/react-vite";
import { dateRange, isoDate, time } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { FieldStory } from "../story-harness";
import { DateField, DateRangeField, TimeField } from "./date-fields";

const meta = { title: "Forms/Date and time", component: DateField } satisfies Meta<typeof DateField>;
export default meta;
type Story = StoryObj<typeof meta>;

const args = { label: "" };

export const SingleDate: Story = {
	args,
	render: () => (
		<FieldStory schema={isoDate()} defaultValue="2026-03-10">
			<DateField label={m.showcase_date()} />
		</FieldStory>
	),
};

export const DateRange: Story = {
	args,
	render: () => (
		<FieldStory schema={dateRange()} defaultValue={{ from: "2026-03-10", to: "2026-03-14" }}>
			<DateRangeField label={m.showcase_range()} />
		</FieldStory>
	),
};

export const Time: Story = {
	args,
	render: () => (
		<FieldStory schema={time()} defaultValue="14:30">
			<TimeField label={m.showcase_time()} />
		</FieldStory>
	),
};
