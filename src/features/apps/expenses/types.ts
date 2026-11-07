import type { IsoDate, IsoMonth } from "@/lib/i18n/date-only";
import type { AppColor } from "../colors";

/** Expenses' limits per user (decision 0192): a guest's rows count the same. */
export const EXPENSES_QUOTAS = { transactions: 5_000, categories: 30, importRows: 1_000, importsPerHour: 10 } as const;

/** The currencies an expense can be in. Totals, charts and budgets are per currency, never converted. */
export const EXPENSE_CURRENCIES = ["NPR", "USD"] as const;
export type ExpenseCurrency = (typeof EXPENSE_CURRENCIES)[number];

export const isExpenseCurrency = (value: string): value is ExpenseCurrency =>
	EXPENSE_CURRENCIES.some((currency) => currency === value);

/** Minor units per major unit (paisa per rupee, cents per dollar): both have two decimals. */
export const MINOR_UNITS = 100;

/** An amount typed in major units (12.5) -> minor units (1250), exactly. */
export const toMinor = (amount: number) => Math.round(amount * MINOR_UNITS);
export const toMajor = (amountMinor: number) => amountMinor / MINOR_UNITS;

/** The icons a category can have (decision 0192), stored by name. */
export const CATEGORY_ICONS = [
	"tag",
	"utensils",
	"coffee",
	"bus",
	"plane",
	"house",
	"zap",
	"shopping-bag",
	"heart-pulse",
	"graduation-cap",
	"film",
	"gift",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const isCategoryIcon = (value: string): value is CategoryIcon => CATEGORY_ICONS.some((icon) => icon === value);

export type ExpenseCategory = { id: string; name: string; color: AppColor; icon: CategoryIcon };

export type ExpenseItem = {
	id: string;
	categoryId: string | null;
	amountMinor: number;
	currency: ExpenseCurrency;
	occurredOn: IsoDate;
	note: string;
};

/** A category's budget for the month and currency on screen, and what was spent against it. */
export type BudgetProgress = { categoryId: string; amountMinor: number; spentMinor: number };

/** One month on the dashboard (/apps/expenses?month=…&currency=…). */
export type ExpensesMonth = {
	month: IsoMonth;
	currency: ExpenseCurrency;
	/** The server's calendar day (the app's time zone): the default date of a new expense. */
	today: IsoDate;
	categories: ExpenseCategory[];
	/** The month's expenses in every currency, newest first. */
	expenses: ExpenseItem[];
	/** Spent in the month in `currency`. */
	totalMinor: number;
	/** Spent per category in `currency`, largest first; `categoryId` null is uncategorized. */
	byCategory: Array<{ categoryId: string | null; amountMinor: number }>;
	/** Spent per month in `currency`: the six months ending with `month`, oldest first. */
	trend: Array<{ month: IsoMonth; amountMinor: number }>;
	budgets: BudgetProgress[];
};

export type CategoryWithUsage = ExpenseCategory & { expenses: number };

/** One row of the CSV export (the import reads the same columns back). */
export type ExpenseExportRow = {
	occurredOn: IsoDate;
	amountMinor: number;
	currency: ExpenseCurrency;
	category: string;
	note: string;
};

export type ImportResult = { inserted: number; categoriesCreated: number; replayed: boolean };
