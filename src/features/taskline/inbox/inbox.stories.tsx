import type { Meta, StoryObj } from "@storybook/react-vite";
import { Suspense } from "react";
import { expect } from "storybook/test";
import { m } from "@/paraglide/messages";
import { sampleTasklineMember } from "../../../../.storybook/mocks/taskline";
import { InboxView } from "./inbox-page";
import { NotifySettingsView } from "./notify-settings";

/** The inbox and "My settings" (Task 50), with the mocked functions (.storybook/mocks/functions/taskline/inbox.ts). */
function Inbox() {
	return (
		<Suspense>
			<InboxView userId={sampleTasklineMember.user.id} search={{ filter: "unread", page: 1 }} />
		</Suspense>
	);
}

const meta = {
	title: "Taskline/Inbox",
	component: Inbox,
	parameters: { app: { session: sampleTasklineMember, route: "/app/taskline/inbox" } },
} satisfies Meta<typeof Inbox>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two unread (a mention with its excerpt, an assignment) and one read due-date notice. */
export const Notifications: Story = {
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { level: 1, name: m.taskline_inbox() })).toBeVisible();
		const sentence = m.taskline_notify_mentioned({ actor: "Bikash Rai", ref: "WEB-4" });
		await expect(canvas.getByRole("link", { name: new RegExp(sentence) })).toBeVisible();
		await expect(canvas.getAllByTestId("inbox-item")).toHaveLength(3);
		await expect(canvas.getByTestId("inbox-read-all")).toBeVisible();
	},
};

/** Per kind: an email at once, the daily digest or off, over the team's defaults; and the email language. */
export const MySettings: Story = {
	parameters: { app: { session: sampleTasklineMember, route: "/app/taskline/settings" } },
	render: () => (
		<Suspense>
			<NotifySettingsView userId={sampleTasklineMember.user.id} />
		</Suspense>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { level: 1, name: m.taskline_my_settings() })).toBeVisible();
		await expect(canvas.getByLabelText(m.taskline_notify_kind_status())).toHaveValue("off");
		await expect(canvas.getByLabelText(m.taskline_notify_kind_assigned())).toHaveValue("instant");
	},
};
