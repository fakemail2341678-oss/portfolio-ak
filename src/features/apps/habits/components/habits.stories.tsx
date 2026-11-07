import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { addDays } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { daysMask } from "../streaks";
import { EVERY_DAY } from "../types";
import { CheckinButton } from "./checkin-button";
import HabitDialog from "./habit-dialog";
import { HabitHeatmap } from "./habit-heatmap";

const TODAY = "2026-10-30";

/** A year of made-up check-ins with gaps: most days done, some part-way. */
const YEAR = Array.from({ length: 360 }, (_, back) => ({
	day: addDays(TODAY, -back),
	count: back % 7 === 3 ? 0 : back % 5 === 0 ? 1 : 2,
})).filter((each) => each.count > 0);

const meta = {
	title: "Apps/Habits",
	component: HabitDialog,
	args: { onSubmit: fn(async () => {}), onClose: fn() },
} satisfies Meta<typeof HabitDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new habit: every day by default; unticking the weekend leaves Monday to Friday. */
export const NewHabit: Story = {
	play: async ({ args }) => {
		const dialog = await within(document.body).findByTestId("habit-dialog");
		await userEvent.type(within(dialog).getByLabelText(m.habits_field_name()), "Stretch");
		const days = within(dialog).getAllByRole("checkbox");
		await userEvent.click(days[0] as HTMLElement);
		await userEvent.click(days[6] as HTMLElement);
		await userEvent.click(within(dialog).getByRole("button", { name: m.crud_create() }));
		await expect(args.onSubmit).toHaveBeenCalledWith({
			name: "Stretch",
			color: "green",
			days: daysMask([1, 2, 3, 4, 5]),
			target: 1,
		});
	},
};

/** A habit needs at least one day. */
export const NoDays: Story = {
	play: async ({ args }) => {
		const dialog = await within(document.body).findByTestId("habit-dialog");
		await userEvent.type(within(dialog).getByLabelText(m.habits_field_name()), "Never");
		for (const box of within(dialog).getAllByRole("checkbox")) await userEvent.click(box);
		await userEvent.click(within(dialog).getByRole("button", { name: m.crud_create() }));
		await expect(await within(dialog).findByText(m.habits_error_days())).toBeVisible();
		await expect(args.onSubmit).not.toHaveBeenCalled();
	},
};

/** A day in the strip: done, part-way, nothing yet, and a day the habit isn't meant for. */
export const CheckinStates: Story = {
	render: () => {
		const habit = { name: "Water", color: "blue" as const, days: daysMask([1, 2, 3, 4, 5]), target: 8 };
		return (
			<ul className="flex gap-1.5">
				{[
					{ day: "2026-10-27", count: 8 },
					{ day: "2026-10-28", count: 5 },
					{ day: "2026-10-29", count: 0 },
					{ day: "2026-10-31", count: 0 },
					{ day: TODAY, count: 0 },
				].map(({ day, count }) => (
					<li key={day}>
						<CheckinButton habit={habit} day={day} today={TODAY} count={count} onTap={fn()} />
					</li>
				))}
			</ul>
		);
	},
	play: async ({ canvas }) => {
		const buttons = canvas.getAllByRole("button");
		await expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
		await expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
	},
};

/** A year of check-ins, drawn on the server: 53 weeks of 7 days, ending today. */
export const Heatmap: Story = {
	render: () => <HabitHeatmap today={TODAY} checkins={YEAR} days={EVERY_DAY} target={2} color="teal" name="Meditate" />,
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("img", { name: /Meditate/ })).toBeVisible();
	},
};
