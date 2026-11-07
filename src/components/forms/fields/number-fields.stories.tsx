import type { Meta, StoryObj } from "@storybook/react-vite";
import { currency, numberRange } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { FieldStory } from "../story-harness";
import { CurrencyField, NumberField } from "./number-fields";

const meta = { title: "Forms/Number fields", component: NumberField } satisfies Meta<typeof NumberField>;
export default meta;
type Story = StoryObj<typeof meta>;

const args = { label: "" };

export const Quantity: Story = {
	args,
	render: () => (
		<FieldStory schema={numberRange({ min: 1, max: 99, integer: true })} defaultValue={3}>
			<NumberField label={m.showcase_quantity()} integer />
		</FieldStory>
	),
};

/** NPR by default; accepts Devanagari digits and shows the locale's grouping. */
export const Currency: Story = {
	args,
	render: () => (
		<FieldStory schema={currency({ max: 10_000_000 })} defaultValue={1234567.5}>
			<CurrencyField label={m.showcase_price()} />
		</FieldStory>
	),
};
