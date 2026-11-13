import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { formatMoney } from "@/lib/i18n/currency";
import { m } from "@/paraglide/messages";
import { getKharchaMe } from "../../../../.storybook/mocks/functions/kharcha/me";
import { sampleKharchaMe, sampleKharchaSession } from "../../../../.storybook/mocks/kharcha";
import { withKharcha } from "../../../../.storybook/mocks/kharcha-section";
import { SettingsView } from "../settings/settings-page";
import { KharchaShell } from "../shell/kharcha-shell";
import { GroupThreadView } from "../threads/group-thread";
import SettleDialog from "./settle-dialog";

/** Task 91's screens: a group's balances and totals, the settle-up dialog, and the profile with the pay note. */
function Screen({ children }: { children: React.ReactNode }) {
	return <KharchaShell>{children}</KharchaShell>;
}

const meta = {
	title: "Kharcha/Settle",
	component: Screen,
	decorators: [withKharcha],
	args: { children: null },
	parameters: {
		layout: "fullscreen",
		app: { session: sampleKharchaSession, route: "/app/kharcha/g/g-trip?tab=balances" },
	},
	beforeEach: () => {
		getKharchaMe.mockResolvedValue(sampleKharchaMe);
	},
} satisfies Meta<typeof Screen>;
export default meta;
type Story = StoryObj<typeof meta>;

const userId = sampleKharchaSession.user.id;
/** Text as the DOM reads it: money's no-break spaces are spaces there. */
const spaced = (text: string) => text.replace(/\s+/g, " ");

/** A group's balances: each member's net in words, and the fewest payments that settle everyone. */
export const Balances: Story = {
	args: { children: <GroupThreadView groupId="g-trip" search={{ tab: "balances" }} /> },
	play: async ({ canvasElement }) => {
		const balances = await within(canvasElement).findByTestId("kharcha-group-balances");
		await expect(within(balances).getAllByTestId("kharcha-balance-member")).toHaveLength(3);
		await expect(within(balances).getAllByTestId("kharcha-balance-transfer")).toHaveLength(2);
		await expect(balances).toHaveTextContent(m.kharcha_balances_simplified());
	},
};

/** A group's totals: what it spent, each member's share and what they paid, and the caller's categories. */
export const Totals: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/g/g-trip?tab=totals" } },
	args: { children: <GroupThreadView groupId="g-trip" search={{ tab: "totals" }} /> },
	play: async ({ canvasElement }) => {
		const totals = await within(canvasElement).findByTestId("kharcha-group-totals");
		await expect(within(totals).getAllByTestId("kharcha-totals-member")).toHaveLength(3);
		await expect(within(totals).getAllByTestId("kharcha-totals-category")).toHaveLength(2);
	},
};

/** Settling up in the trip: a suggestion picked, Asha's pay note, and a partial amount said in words. */
export const SettleUp: Story = {
	args: {
		children: (
			<SettleDialog me={sampleKharchaMe} userId={userId} start={{ groupId: "g-trip" }} onClose={() => undefined} />
		),
	},
	play: async ({ canvasElement, userEvent }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByTestId("kharcha-settle-dialog");
		const choices = within(dialog).getAllByRole("radio");
		await expect(choices).toHaveLength(3);
		await userEvent.click(choices[1] ?? dialog);
		await expect(within(dialog).getByTestId("kharcha-settle-pay-note")).toHaveTextContent("eSewa 9801234567");
		const amount = within(dialog).getByRole("textbox", { name: m.kharcha_field_amount() });
		await userEvent.clear(amount);
		await userEvent.type(amount, "1000");
		const left = formatMoney(433_333 - 100_000, "NPR");
		await waitFor(() => expect(dialog).toHaveTextContent(spaced(m.kharcha_settle_partial({ amount: left }))));
	},
};

/** Paid in another currency: the rate typed, what was handed over shown as it is typed. */
export const OtherCurrency: Story = {
	args: {
		children: (
			<SettleDialog me={sampleKharchaMe} userId={userId} start={{ groupId: "g-trip" }} onClose={() => undefined} />
		),
	},
	play: async ({ canvasElement, userEvent }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByTestId("kharcha-settle-dialog");
		await userEvent.click(within(dialog).getByRole("checkbox", { name: m.kharcha_settle_other() }));
		const rate = await within(dialog).findByRole("textbox", {
			name: m.kharcha_settle_rate({ from: "NPR", to: "INR" }),
		});
		await userEvent.type(rate, "0.625");
		// NPR 1,866.67 at 0.625: INR 1,166.67.
		const handed = m.kharcha_settle_handed({ amount: formatMoney(116_667, "INR") });
		await waitFor(() => expect(within(dialog).getByTestId("kharcha-settle-handed")).toHaveTextContent(spaced(handed)));
	},
};

/** Settings → Profile: the pay note friends see, the home currency and the time zone. */
export const Profile: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/settings/profile" } },
	args: { children: <SettingsView tab="profile" /> },
	play: async ({ canvasElement }) => {
		const profile = await within(canvasElement).findByTestId("kharcha-profile");
		await expect(
			within(profile).getByRole("textbox", { name: new RegExp(m.kharcha_profile_pay_note()) }),
		).toBeVisible();
	},
};
