import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { getKharchaHome, getKharchaMe } from "../../../../.storybook/mocks/functions/kharcha/me";
import {
	sampleKharchaDetail,
	sampleKharchaDraft,
	sampleKharchaHome,
	sampleKharchaMe,
	sampleKharchaSession,
	sampleKharchaSpend,
} from "../../../../.storybook/mocks/kharcha";
import { withKharcha } from "../../../../.storybook/mocks/kharcha-section";
import { KharchaHome } from "../home/kharcha-home";
import { SettingsView } from "../settings/settings-page";
import { KharchaShell } from "../shell/kharcha-shell";
import { SpendView } from "../spend/spend-page";
import ExpenseDialog from "./expense-dialog";
import { ExpensePanel } from "./expense-panel";
import ReceiptViewer from "./receipt-viewer";

/** Task 89's screens: the expense dialog, the expense, receipts, Spend, Settings and Home's to-dos. */
function Screen({ children }: { children: React.ReactNode }) {
	return <KharchaShell>{children}</KharchaShell>;
}

const meta = {
	title: "Kharcha/Expenses",
	component: Screen,
	decorators: [withKharcha],
	args: { children: null },
	parameters: {
		layout: "fullscreen",
		app: { session: sampleKharchaSession, route: "/app/kharcha/spend" },
	},
	beforeEach: () => {
		getKharchaMe.mockResolvedValue(sampleKharchaMe);
	},
} satisfies Meta<typeof Screen>;
export default meta;
type Story = StoryObj<typeof meta>;

const userId = sampleKharchaSession.user.id;
const spendSearch = { q: "", category: [], sort: "-date" as const, page: 1 };

/**
 * Add expense: amount (Devanagari digits read too), currency and date, the merchant with
 * its completion, then the caller's own category, method and tags. Typing a merchant a rule
 * knows fills the category (Bhatbhateni: Groceries).
 */
export const AddExpense: Story = {
	args: { children: <ExpenseDialog me={sampleKharchaMe} userId={userId} onClose={() => undefined} /> },
	play: async ({ canvasElement, userEvent }) => {
		const body = within(canvasElement.ownerDocument.body);
		const dialog = await body.findByTestId("kharcha-expense-dialog");
		await userEvent.type(
			within(dialog).getByRole("combobox", { name: new RegExp(m.kharcha_field_merchant()) }),
			"Bhatbhateni",
		);
		await waitFor(() =>
			expect(within(dialog).getByRole("combobox", { name: m.kharcha_field_category() })).toHaveTextContent("Groceries"),
		);
		await expect(within(dialog).getByTestId("kharcha-receipts")).toBeVisible();
	},
};

/** Editing: everything as it was saved, its receipt among them. */
export const EditExpense: Story = {
	args: {
		children: (
			<ExpenseDialog me={sampleKharchaMe} userId={userId} expense={sampleKharchaDetail} onClose={() => undefined} />
		),
	},
	play: async ({ canvasElement }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByTestId("kharcha-expense-dialog");
		await expect(
			within(dialog).getByRole("button", { name: m.kharcha_receipt_open({ number: formatNumber(1) }) }),
		).toBeVisible();
	},
};

/** The expense: its part for the caller, a possible duplicate to dismiss, its receipt and its history. */
export const Expense: Story = {
	args: {
		children: (
			<main className="max-w-xl p-6">
				<ExpensePanel expense={sampleKharchaDetail} userId={userId} />
			</main>
		),
	},
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("button", { name: m.kharcha_duplicate_dismiss() })).toBeVisible();
		await expect(canvas.getByText("Groceries", { selector: "dd" })).toBeVisible();
		await expect(canvas.getByRole("heading", { name: m.kharcha_expense_history() })).toBeVisible();
	},
};

/** The receipt viewer: zoom, turn, the next receipt. */
export const Receipts: Story = {
	args: {
		children: (
			<ReceiptViewer
				receipts={[...sampleKharchaDetail.receipts, ...sampleKharchaDraft.receipts]}
				start={0}
				onClose={() => undefined}
			/>
		),
	},
	play: async ({ canvasElement, userEvent }) => {
		const viewer = await within(canvasElement.ownerDocument.body).findByTestId("kharcha-receipt-viewer");
		await userEvent.click(within(viewer).getByRole("button", { name: m.kharcha_receipt_next() }));
		await expect(viewer).toHaveTextContent(formatNumber(2));
	},
};

/** Spend: this month, newest first, the caller's share on each line, fix badges, the total. */
export const Spend: Story = {
	args: { children: <SpendView search={spendSearch} /> },
	play: async ({ canvas }) => {
		await waitFor(() =>
			expect(canvas.getAllByTestId("kharcha-spend-row")).toHaveLength(sampleKharchaSpend.items.length),
		);
		await expect(canvas.getByTestId("kharcha-spend-total")).toBeVisible();
	},
};

/** Settings: the categories, with their colours, order and the archived one. */
export const Settings: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/settings/categories" } },
	args: { children: <SettingsView tab="categories" /> },
	play: async ({ canvas }) => {
		await waitFor(() => expect(canvas.getAllByTestId("kharcha-settings-item").length).toBeGreaterThan(3));
		await expect(canvas.getByText(m.kharcha_settings_archived())).toBeVisible();
	},
};

/** Home's to-dos: a receipt waiting for its details, and a possible duplicate. */
export const HomeTodos: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/home" } },
	args: { children: <KharchaHome /> },
	beforeEach: () => {
		const [first] = sampleKharchaSpend.items;
		getKharchaHome.mockResolvedValue({
			...sampleKharchaHome,
			todos: [
				{ kind: "receipt", draft: sampleKharchaDraft },
				...(first
					? [
							{
								kind: "duplicate" as const,
								expense: first,
								of: sampleKharchaDetail.duplicates[0] ?? { id: "x", title: "", spentOn: "2026-11-10" },
							},
						]
					: []),
			],
		});
	},
	play: async ({ canvas }) => {
		await expect(await canvas.findByTestId("kharcha-todo-receipt")).toBeVisible();
		await expect(canvas.getByTestId("kharcha-todo-duplicate")).toBeVisible();
	},
};
