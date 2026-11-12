import { fn } from "storybook/test";
import type { ExpenseDetail, ExpenseView, MerchantSuggestion, SpendPage } from "../../../../src/features/kharcha/types";
import { sampleKharchaDetail, sampleKharchaExpense, sampleKharchaMerchants, sampleKharchaSpend } from "../../kharcha";

// Stand-ins for src/functions/kharcha/expenses.ts.
const expense = async (): Promise<ExpenseView> => sampleKharchaExpense;
export const getKharchaExpense = fn(async (): Promise<ExpenseDetail> => sampleKharchaDetail).mockName(
	"getKharchaExpense",
);
export const createKharchaExpense = fn(expense).mockName("createKharchaExpense");
export const updateKharchaExpense = fn(expense).mockName("updateKharchaExpense");
export const deleteKharchaExpense = fn(
	async (): Promise<ExpenseView> => ({
		...sampleKharchaExpense,
		deletedAt: "2026-11-12T08:00:00.000Z",
		can: { edit: false, delete: false, restore: true },
	}),
).mockName("deleteKharchaExpense");
export const restoreKharchaExpense = fn(expense).mockName("restoreKharchaExpense");
export const markKharchaDuplicate = fn(expense).mockName("markKharchaDuplicate");
export const listKharchaSpend = fn(async (): Promise<SpendPage> => sampleKharchaSpend).mockName("listKharchaSpend");
export const getKharchaMerchants = fn(async (): Promise<MerchantSuggestion[]> => sampleKharchaMerchants).mockName(
	"getKharchaMerchants",
);
