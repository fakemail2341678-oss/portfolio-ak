import type { Meta, StoryObj } from "@storybook/react-vite";
import { hexColor, numberRange, tags } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { FieldStory } from "../story-harness";
import { ColorField, SliderField, TagsInputField } from "./misc-fields";

const meta = { title: "Forms/Slider, tags and colour", component: SliderField } satisfies Meta<typeof SliderField>;
export default meta;
type Story = StoryObj<typeof meta>;

const args = { label: "" };

export const Slider: Story = {
	args,
	render: () => (
		<FieldStory schema={numberRange({ min: 0, max: 100 })} defaultValue={40}>
			<SliderField label={m.showcase_volume()} />
		</FieldStory>
	),
};

export const TagsInput: Story = {
	args,
	render: () => (
		<FieldStory schema={tags({ max: 5 })} defaultValue={["momo", "nepal"]}>
			<TagsInputField label={m.showcase_tags()} />
		</FieldStory>
	),
};

export const Color: Story = {
	args,
	render: () => (
		<FieldStory schema={hexColor()} defaultValue="#2563eb">
			<ColorField label={m.showcase_color()} />
		</FieldStory>
	),
};
