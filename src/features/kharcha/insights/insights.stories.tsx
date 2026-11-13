import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { m } from "@/paraglide/messages";
import { getKharchaHome, getKharchaMe } from "../../../../.storybook/mocks/functions/kharcha/me";
import { sampleKharchaHome, sampleKharchaMe, sampleKharchaSession } from "../../../../.storybook/mocks/kharcha";
import { sampleKharchaBudgets, sampleKharchaRecurring } from "../../../../.storybook/mocks/kharcha-plan";
import { withKharcha } from "../../../../.storybook/mocks/kharcha-section";
import BudgetDialog from "../budgets/budget-dialog";
import { KharchaHome } from "../home/kharcha-home";
import RepeatDialog from "../recurring/repeat-dialog";
import { SettingsView } from "../settings/settings-page";
import { KharchaShell } from "../shell/kharcha-shell";
import { InsightsView } from "./insights-page";

/** Task 94's screens: Insights' four tabs, the budget and repeat dialogs, Settings → Recurring, and Home with budgets. */
function Screen({ children }: { children: React.ReactNode }) {
	return <KharchaShell>{children}</KharchaShell>;
}

const meta = {
	title: "Kharcha/Insights",
	component: Screen,
	decorators: [withKharcha],
	args: { children: null },
	parameters: {
		layout: "fullscreen",
		app: { session: sampleKharchaSession, route: "/app/kharcha/insights/overview" },
	},
	beforeEach: () => {
		getKharchaMe.mockResolvedValue(sampleKharchaMe);
	},
} satisfies Meta<typeof Screen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The overview: the month's total against October's, by category, top merchants, every day, the calendar. */
export const Overview: Story = {
	args: { children: <InsightsView tab="overview" search={{}} /> },
	play: async ({ canvas }) => {
		await expect(await canvas.findByTestId("kharcha-insights-total")).toBeVisible();
		await expect(canvas.getByTestId("kharcha-insights-currency")).toBeVisible();
		const calendar = canvas.getByTestId("kharcha-insights-calendar");
		await expect(within(calendar).getAllByRole("columnheader")).toHaveLength(7);
		// A chart's numbers are a table too (ChartFrame), once the chart has loaded.
		await expect(await canvas.findByTestId("kharcha-insights-categories", {}, { timeout: 5000 })).toBeVisible();
		await expect(canvas.getAllByRole("listitem").length).toBeGreaterThan(0);
	},
};

/** Budgets: on track, near its limit, and over (hatched, said in words), with earlier periods. */
export const Budgets: Story = {
	args: { children: <InsightsView tab="budgets" search={{}} /> },
	play: async ({ canvas }) => {
		const meters = await canvas.findAllByTestId("kharcha-budget-meter");
		await expect(meters.map((meter) => meter.dataset.state)).toEqual(["near", "ok", "over"]);
		await expect(canvas.getAllByRole("meter")[0]).toHaveAccessibleName("Food and drink");
		await expect(canvas.getByText(m.kharcha_budget_state_over(), { exact: false })).toBeVisible();
	},
};

/** Trends: twelve months, by category, tag and shared spending, each line named in the legend. */
export const Trends: Story = {
	args: { children: <InsightsView tab="trends" search={{}} /> },
	play: async ({ canvas }) => {
		await expect(await canvas.findByTestId("kharcha-insights-monthly")).toBeVisible();
		await expect(canvas.getByTestId("kharcha-trends-shared")).toBeVisible();
	},
};

/** A statement: totals, by category, every expense, and Print. */
export const Statement: Story = {
	args: { children: <InsightsView tab="statement" search={{}} /> },
	play: async ({ canvas }) => {
		const lines = await canvas.findByTestId("kharcha-statement-lines");
		await expect(within(lines).getAllByRole("row")).toHaveLength(5);
		await expect(canvas.getByRole("button", { name: m.kharcha_statement_print() })).toBeVisible();
	},
};

/** A new budget: a category or everything, the period and currency, the limit and its first day. */
export const NewBudget: Story = {
	args: {
		children: (
			<BudgetDialog
				categories={[]}
				currencies={["NPR", "USD"]}
				homeCurrency="NPR"
				today="2026-11-12"
				onSaved={() => undefined}
				onClose={() => undefined}
			/>
		),
	},
	play: async ({ canvasElement }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByTestId("kharcha-budget-dialog");
		await expect(within(dialog).getByLabelText(m.kharcha_budget_amount())).toBeVisible();
	},
};

/** Editing a monthly budget: this month's own amount. */
export const EditBudget: Story = {
	args: {
		children: (
			<BudgetDialog
				budget={sampleKharchaBudgets[2]}
				categories={[]}
				currencies={["NPR"]}
				homeCurrency="NPR"
				today="2026-11-12"
				onSaved={() => undefined}
				onClose={() => undefined}
			/>
		),
	},
	play: async ({ canvasElement }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByTestId("kharcha-budget-dialog");
		await expect(within(dialog).getAllByRole("textbox").length).toBeGreaterThanOrEqual(2);
	},
};

/** "Repeat": how often, the end, and the next one said as it is chosen. */
export const Repeat: Story = {
	args: {
		children: (
			<RepeatDialog
				from={{ expenseId: "e-rent", spentOn: "2026-10-31" }}
				today="2026-11-12"
				onSaved={() => undefined}
				onClose={() => undefined}
			/>
		),
	},
	play: async ({ canvasElement }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByTestId("kharcha-repeat-dialog");
		// From 31 October, monthly: the next one is the last day of November.
		await expect(within(dialog).getByTestId("kharcha-repeat-next")).toHaveTextContent(m.kharcha_recurring_monthly());
	},
};

/** Settings → Recurring: next due, paused, and paused because it couldn't be made. */
export const Recurring: Story = {
	args: { children: <SettingsView tab="recurring" /> },
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/settings/recurring" } },
	play: async ({ canvas }) => {
		const items = await canvas.findAllByTestId("kharcha-recurring-item");
		await expect(items).toHaveLength(sampleKharchaRecurring.length);
		await expect(items[2]).toHaveTextContent(m.kharcha_recurring_problem_group());
	},
};

/** Home with budgets: the nearest to its limit first, and the over-budget one as a to-do. */
export const HomeBudgets: Story = {
	args: { children: <KharchaHome /> },
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/home" } },
	beforeEach: () => {
		const [near, , over] = sampleKharchaBudgets;
		getKharchaHome.mockResolvedValue({
			...sampleKharchaHome,
			budgets: sampleKharchaBudgets,
			todos: [
				...(over ? [{ kind: "budget" as const, budget: over }] : []),
				...(near ? [{ kind: "budget" as const, budget: near }] : []),
				...(sampleKharchaRecurring[0] ? [{ kind: "recurring" as const, recurring: sampleKharchaRecurring[0] }] : []),
			],
		});
	},
	play: async ({ canvas }) => {
		await expect(await canvas.findByTestId("kharcha-home-budgets")).toBeVisible();
		await expect(canvas.getAllByTestId("kharcha-todo-budget")).toHaveLength(2);
		await expect(canvas.getByTestId("kharcha-todo-recurring")).toBeVisible();
	},
};
