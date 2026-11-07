import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { richText } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { FieldStory } from "../story-harness";
import { RichTextField } from "./rich-text-field";

const meta = { title: "Forms/Rich text", component: RichTextField } satisfies Meta<typeof RichTextField>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Tiptap loads in the browser (the server renders a same-size placeholder). Its first, cold load in a
 * parallel story run can take well over 20s, so the loader imports it before the story renders. */
export const RichText: Story = {
	args: { label: "" },
	loaders: [async () => ({ editor: await import("./rich-text-editor") })],
	render: () => (
		<FieldStory schema={richText({ max: 2000 })} defaultValue="<p>Hello <strong>Kathmandu</strong></p>">
			<RichTextField label={m.showcase_body()} />
		</FieldStory>
	),
	play: async ({ canvas }) => {
		const editor = await canvas.findByRole("textbox", { name: m.showcase_body() }, { timeout: 20_000 });
		await expect(editor).toHaveAttribute("contenteditable", "true");
		await expect(canvas.getByRole("toolbar", { name: m.rt_toolbar() })).toBeVisible();
	},
};
