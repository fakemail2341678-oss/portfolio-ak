import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { m } from "@/paraglide/messages";
import type { ExpenseCategory, ExpenseItem } from "../types";
import { CategoryLabel } from "./category-label";
import ExpenseDialog from "./expense-dialog";

const CATEGORIES: ExpenseCategory[] = [
	{ id: "00000000-0000-4000-8000-000000000001", name: "Food", color: "orange", icon: "utensils" },
	{ id: "00000000-0000-4000-8000-000000000002", name: "Transport", color: "blue", icon: "bus" },
	{ id: "00000000-0000-4000-8000-000000000003", name: "Health", color: "red", icon: "heart-pulse" },
];

const EXPENSE: ExpenseItem = {
	id: "00000000-0000-4000-8000-000000000010",
	categoryId: CATEGORIES[0]?.id ?? null,
	amountMinor: 45_050,
	currency: "NPR",
	occurredOn: "2026-10-01",
	note: "Momo with friends",
};

const meta = {
	title: "Apps/Expenses",
	component: ExpenseDialog,
	args: {
		categories: CATEGORIES,
		today: "2026-10-30",
		defaultCurrency: "NPR",
		onSubmit: fn(async () => {}),
		onClose: fn(),
	},
} satisfies Meta<typeof ExpenseDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new expense: the amount is typed in rupees and sent in paisa; today is the default day. */
export const NewExpense: Story = {
	play: async ({ args }) => {
		const dialog = await within(document.body).findByTestId("expense-dialog");
		await userEvent.type(within(dialog).getByLabelText(m.expenses_field_amount()), "1250.5");
		await userEvent.type(within(dialog).getByLabelText(new RegExp(m.expenses_field_note())), "Bus card");
		await userEvent.click(within(dialog).getByRole("button", { name: m.expenses_add() }));
		await expect(args.onSubmit).toHaveBeenCalledWith({
			amountMinor: 125_050,
			currency: "NPR",
			occurredOn: "2026-10-30",
			categoryId: null,
			note: "Bus card",
		});
	},
};

/** The rules on the form: an amount above zero, with at most two decimals. */
export const Invalid: Story = {
	play: async ({ args }) => {
		const dialog = await within(document.body).findByTestId("expense-dialog");
		await userEvent.type(within(dialog).getByLabelText(m.expenses_field_amount()), "0.001");
		await userEvent.click(within(dialog).getByRole("button", { name: m.expenses_add() }));
		await expect(await within(dialog).findByText(m.validation_currency_decimals())).toBeVisible();
		await expect(args.onSubmit).not.toHaveBeenCalled();
	},
};

/** Editing: the expense's own amount, day and category. */
export const EditExpense: Story = {
	args: { expense: EXPENSE },
	play: async () => {
		const dialog = await within(document.body).findByTestId("expense-dialog");
		await expect(within(dialog).getByLabelText(new RegExp(m.expenses_field_note()))).toHaveValue(EXPENSE.note);
		await expect(within(dialog).getByRole("button", { name: m.crud_save() })).toBeVisible();
	},
};

/** Categories as the dashboard shows them: a coloured icon and the name; none is "Uncategorized". */
export const Categories: Story = {
	render: () => (
		<ul className="flex flex-col gap-2 text-sm">
			{[...CATEGORIES, null].map((category) => (
				<li key={category?.id ?? "none"}>
					<CategoryLabel category={category} />
				</li>
			))}
		</ul>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByText(m.expenses_uncategorized())).toBeVisible();
	},
};
