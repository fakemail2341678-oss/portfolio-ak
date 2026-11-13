import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { m } from "@/paraglide/messages";
import {
	createKharchaComment,
	reactKharchaComment,
} from "../../../../.storybook/mocks/functions/kharcha/conversations";
import { getKharchaMe } from "../../../../.storybook/mocks/functions/kharcha/me";
import { sampleKharchaMe, sampleKharchaSession } from "../../../../.storybook/mocks/kharcha";
import { withKharcha } from "../../../../.storybook/mocks/kharcha-section";
import { KharchaHome } from "../home/kharcha-home";
import { PeopleView } from "../people/people-page";
import { SettingsView } from "../settings/settings-page";
import { KharchaShell } from "../shell/kharcha-shell";
import { GroupThreadView } from "./group-thread";

/** Task 92's screens: a thread's comments and composer, Home's Updates with the bell, People's badges, and the email settings. */
function Screen({ children }: { children: React.ReactNode }) {
	return <KharchaShell>{children}</KharchaShell>;
}

const meta = {
	title: "Kharcha/Talk",
	component: Screen,
	decorators: [withKharcha],
	args: { children: null },
	parameters: {
		layout: "fullscreen",
		app: { session: sampleKharchaSession, route: "/app/kharcha/g/g-trip" },
	},
	beforeEach: () => {
		getKharchaMe.mockResolvedValue(sampleKharchaMe);
	},
} satisfies Meta<typeof Screen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The trip's thread: Asha's comment (a mention, a link, reactions), and the composer with "@" suggestions. */
export const Thread: Story = {
	args: { children: <GroupThreadView groupId="g-trip" search={{ tab: "thread" }} /> },
	play: async ({ canvasElement, userEvent }) => {
		const canvas = within(canvasElement);
		const comment = await canvas.findByTestId("kharcha-comment");
		await expect(within(comment).getByText("@Bikash Rai")).toBeInTheDocument();
		await expect(within(comment).getByRole("link", { name: "https://example.com/phewa" })).toHaveAttribute(
			"rel",
			"noopener noreferrer nofollow ugc",
		);
		const thumbs = within(comment).getByRole("button", { pressed: true });
		await userEvent.click(thumbs);
		await waitFor(() => expect(reactKharchaComment).toHaveBeenCalled());

		const text = canvas.getByTestId("kharcha-composer-text");
		await userEvent.type(text, "Thanks @Gur");
		const options = await canvas.findByTestId("kharcha-mention-options");
		await expect(within(options).getAllByRole("button")).toHaveLength(1);
		await userEvent.keyboard("{Tab}");
		await expect(text).toHaveValue("Thanks @Asha Gurung ");
		await userEvent.click(canvas.getByTestId("kharcha-composer-send"));
		await waitFor(() => expect(createKharchaComment).toHaveBeenCalled());
		await expect(createKharchaComment.mock.lastCall?.[0].data.mentions).toEqual(["p-asha"]);
	},
};

/** Home's Updates: the unread ones marked, Mark all read, and the bell's count in the rail. */
export const Updates: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/home" } },
	args: { children: <KharchaHome /> },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const updates = await canvas.findByTestId("kharcha-updates");
		await expect(within(updates).getAllByTestId("kharcha-update")).toHaveLength(3);
		await expect(canvas.getByTestId("kharcha-updates-read-all")).toBeInTheDocument();
		await waitFor(() => expect(canvas.getAllByTestId("kharcha-bell-count")[0]).toBeInTheDocument());
	},
};

/** People with unread badges and the focus switch. */
export const People: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/people" } },
	args: { children: <PeopleView search={{ q: "" }} /> },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findAllByTestId("kharcha-people-unread")).toHaveLength(2);
		await expect(canvas.getByTestId("kharcha-people-focus")).toHaveAttribute("aria-pressed", "false");
	},
};

/** Settings → Notifications: how each kind is emailed. */
export const EmailSettings: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/settings/notifications" } },
	args: { children: <SettingsView tab="notifications" /> },
	play: async ({ canvasElement }) => {
		const form = await within(canvasElement).findByTestId("kharcha-notify");
		await expect(within(form).getAllByRole("combobox")).toHaveLength(10);
		await expect(within(form).getByRole("combobox", { name: m.kharcha_notify_kind_payment() })).toBeInTheDocument();
	},
};
