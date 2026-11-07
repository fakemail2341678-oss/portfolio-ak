import type { Meta, StoryObj } from "@storybook/react-vite";
import { z } from "zod";
import { choice, choices, mustAccept } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { FieldStory } from "../story-harness";
import {
	CheckboxField,
	CheckboxGroupField,
	ComboboxField,
	MultiSelectField,
	RadioGroupField,
	SelectField,
	SwitchField,
} from "./choice-fields";

const meta = { title: "Forms/Choice fields", component: SelectField } satisfies Meta<typeof SelectField>;
export default meta;
type Story = StoryObj<typeof meta>;

// Proper nouns: shown as-is in both languages.
const districts = ["Kathmandu", "Lalitpur", "Bhaktapur", "Kaski", "Chitwan"].map((name) => ({
	value: name.toLowerCase(),
	label: name,
}));
const plans = () => [
	{ value: "free", label: m.showcase_plan_free() },
	{ value: "pro", label: m.showcase_plan_pro() },
];
const interests = () => [
	{ value: "design", label: m.showcase_interest_design() },
	{ value: "code", label: m.showcase_interest_code() },
	{ value: "writing", label: m.showcase_interest_writing() },
];
const args = { label: "", options: districts };

export const Select: Story = {
	args,
	render: () => (
		<FieldStory schema={choice()} defaultValue="">
			<SelectField label={m.showcase_district()} options={districts} />
		</FieldStory>
	),
};

export const Combobox: Story = {
	args,
	render: () => (
		<FieldStory schema={choice()} defaultValue="lalitpur">
			<ComboboxField label={m.showcase_district()} options={districts} />
		</FieldStory>
	),
};

export const MultiSelect: Story = {
	args,
	render: () => (
		<FieldStory schema={choices()} defaultValue={["kathmandu", "kaski"]}>
			<MultiSelectField label={m.showcase_districts()} options={districts} />
		</FieldStory>
	),
};

export const RadioGroup: Story = {
	args,
	render: () => (
		<FieldStory schema={choice()} defaultValue="free">
			<RadioGroupField label={m.showcase_plan()} options={plans()} />
		</FieldStory>
	),
};

export const Checkbox: Story = {
	args,
	render: () => (
		<FieldStory schema={mustAccept()} defaultValue={false}>
			<CheckboxField label={m.showcase_terms()} />
		</FieldStory>
	),
};

export const CheckboxGroup: Story = {
	args,
	render: () => (
		<FieldStory schema={choices()} defaultValue={["code"]}>
			<CheckboxGroupField label={m.showcase_interests()} options={interests()} />
		</FieldStory>
	),
};

export const Switch: Story = {
	args,
	render: () => (
		<FieldStory schema={z.boolean()} defaultValue={true}>
			<SwitchField label={m.showcase_newsletter()} />
		</FieldStory>
	),
};
