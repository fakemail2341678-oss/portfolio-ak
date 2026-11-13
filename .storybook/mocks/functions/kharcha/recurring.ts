import { fn } from "storybook/test";
import type { RecurringView } from "../../../../src/features/kharcha/types";
import { sampleKharchaRecurring } from "../../kharcha-plan";

// Stand-ins for src/functions/kharcha/recurring.ts.
const all = async (): Promise<RecurringView[]> => sampleKharchaRecurring;
export const listKharchaRecurring = fn(all).mockName("listKharchaRecurring");
export const repeatKharchaExpense = fn(all).mockName("repeatKharchaExpense");
export const updateKharchaRecurring = fn(all).mockName("updateKharchaRecurring");
export const pauseKharchaRecurring = fn(all).mockName("pauseKharchaRecurring");
export const skipKharchaRecurring = fn(all).mockName("skipKharchaRecurring");
export const deleteKharchaRecurring = fn(all).mockName("deleteKharchaRecurring");
