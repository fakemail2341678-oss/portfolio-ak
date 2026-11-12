import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { m } from "@/paraglide/messages";
import { getKharchaMe } from "../../../../.storybook/mocks/functions/kharcha/me";
import { sampleKharchaInvite, sampleKharchaMe, sampleKharchaSession } from "../../../../.storybook/mocks/kharcha";
import { withKharcha } from "../../../../.storybook/mocks/kharcha-section";
import ExpenseDialog from "../expenses/expense-dialog";
import { JoinView } from "../join/join-page";
import { KharchaShell } from "../shell/kharcha-shell";
import { FriendThreadView } from "../threads/friend-thread";
import { GroupThreadView } from "../threads/group-thread";
import { PeopleView } from "./people-page";

/** Task 90's screens: People, a group's thread and settings, a friend's thread, the split editor, an invite's page. */
function Screen({ children }: { children: React.ReactNode }) {
	return <KharchaShell>{children}</KharchaShell>;
}

const meta = {
	title: "Kharcha/People",
	component: Screen,
	decorators: [withKharcha],
	args: { children: null },
	parameters: {
		layout: "fullscreen",
		app: { session: sampleKharchaSession, route: "/app/kharcha/people" },
	},
	beforeEach: () => {
		getKharchaMe.mockResolvedValue(sampleKharchaMe);
	},
} satisfies Meta<typeof Screen>;
export default meta;
type Story = StoryObj<typeof meta>;

const userId = sampleKharchaSession.user.id;

/** People: groups, then friends, each with what is open with it; Sita hasn't joined and is invited. */
export const People: Story = {
	args: { children: <PeopleView search={{ q: "" }} /> },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByTestId("kharcha-people-groups")).toHaveTextContent("Pokhara trip");
		await expect(canvas.getByTestId("kharcha-people-friends")).toHaveTextContent(m.kharcha_friend_invited());
		await expect(canvas.getByTestId("kharcha-people-hidden")).toBeVisible();
	},
};

/** A group's thread: the cards of its expenses and a payment, and the app's own lines, day by day. */
export const GroupThread: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/g/g-trip" } },
	args: { children: <GroupThreadView groupId="g-trip" search={{ tab: "thread" }} /> },
	play: async ({ canvasElement }) => {
		const thread = await within(canvasElement).findByTestId("kharcha-thread");
		await expect(thread).toHaveTextContent("Lakeside dinner");
		await expect(thread).toHaveTextContent("eSewa");
	},
};

/** A group's settings: details, members (invite and remove), archiving and leaving. */
export const GroupSettings: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/g/g-trip?tab=settings" } },
	args: { children: <GroupThreadView groupId="g-trip" search={{ tab: "settings" }} /> },
	play: async ({ canvasElement }) => {
		const settings = await within(canvasElement).findByTestId("kharcha-group-settings");
		await expect(within(settings).getAllByTestId("kharcha-member")).toHaveLength(3);
		await expect(within(settings).getByTestId("kharcha-group-leave")).toBeVisible();
	},
};

/** A friend's thread: their groups with the balance in each, then what is between the two. */
export const FriendThread: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/f/p-asha" } },
	args: { children: <FriendThreadView personId="p-asha" search={{ tab: "thread" }} /> },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByTestId("kharcha-thread")).toHaveTextContent("Coffee at Himalayan Java");
		await expect(canvas.getByTestId("kharcha-friend-group")).toHaveTextContent("Pokhara trip");
	},
};

/** The split editor in the dialog: the group's members, equally, and the sentence the split makes. */
export const SplitABill: Story = {
	args: {
		children: <ExpenseDialog me={sampleKharchaMe} userId={userId} groupId="g-trip" onClose={() => undefined} />,
	},
	play: async ({ canvasElement, userEvent }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByTestId("kharcha-expense-dialog");
		const editor = await within(dialog).findByTestId("kharcha-split-editor");
		await userEvent.type(within(dialog).getByRole("textbox", { name: m.kharcha_field_amount() }), "3000");
		await waitFor(() => expect(within(editor).getByTestId("kharcha-split-status")).toHaveAttribute("data-ok", "true"));
		await userEvent.click(within(editor).getByRole("radio", { name: m.kharcha_split_method_itemized() }));
		await expect(within(editor).getByTestId("kharcha-split-itemized")).toBeVisible();
	},
};

/** An invite's page, signed in: who sent it, the group, and the confirm. */
export const Join: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/join/Zk3pQ9xR2mT7vB4nL8sW1yC6hJ0dF5gA" } },
	render: () => <JoinView token="Zk3pQ9xR2mT7vB4nL8sW1yC6hJ0dF5gA" invite={sampleKharchaInvite} />,
	play: async ({ canvasElement }) => {
		const page = await within(canvasElement).findByTestId("kharcha-join");
		await expect(page).toHaveTextContent("Pokhara trip");
		await expect(within(page).getByTestId("kharcha-join-accept")).toBeVisible();
	},
};
