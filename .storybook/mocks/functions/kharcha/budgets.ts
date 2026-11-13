import { fn } from "storybook/test";
import type { BudgetView } from "../../../../src/features/kharcha/types";
import { sampleKharchaBudgets } from "../../kharcha-plan";

// Stand-ins for src/functions/kharcha/budgets.ts.
const all = async (): Promise<BudgetView[]> => sampleKharchaBudgets;
export const listKharchaBudgets = fn(all).mockName("listKharchaBudgets");
export const createKharchaBudget = fn(all).mockName("createKharchaBudget");
export const updateKharchaBudget = fn(all).mockName("updateKharchaBudget");
export const setKharchaBudgetMonth = fn(all).mockName("setKharchaBudgetMonth");
export const deleteKharchaBudget = fn(all).mockName("deleteKharchaBudget");
