import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { phone } from "@/lib/phone";
import { otp } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { FieldStory } from "../story-harness";
import { OtpField, PhoneField } from "./phone-otp-fields";

const meta = { title: "Forms/Phone and code", component: PhoneField } satisfies Meta<typeof PhoneField>;
export default meta;
type Story = StoryObj<typeof meta>;

const args = { label: "" };

/** Nepal (+977) by default; stores E.164. */
export const Phone: Story = {
	args,
	render: () => (
		<FieldStory schema={phone()} defaultValue="+9779812345678">
			<PhoneField label={m.showcase_phone()} />
		</FieldStory>
	),
};

/** Six digits; pasting a code fills every slot. */
export const Otp: Story = {
	args,
	render: () => (
		<FieldStory schema={otp()} defaultValue="">
			<OtpField label={m.showcase_code()} />
		</FieldStory>
	),
	play: async ({ canvas, userEvent }) => {
		const input = canvas.getByLabelText(m.showcase_code());
		await expect(input).toHaveAttribute("autocomplete", "one-time-code");
		await userEvent.click(input);
		await userEvent.paste("123456");
		await expect(input).toHaveValue("123456");
	},
};
