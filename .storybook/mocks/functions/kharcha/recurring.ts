import { fn } from "storybook/test";
import type { RecurringView } from "../../../../src/features/kharcha/types";
import { sampleKharchaRecurring } from "../../kharcha-plan";

// Stand-ins for src/functions/kharcha/recurring.ts.
const all = async (): Promise<RecurringView[]> => sampleKharchaRecurring;
export const listKharchaRecurring = fn(all).mockName("listKharchaRecurring");
export const createKharchaRecurring = fn(all).mockName("createKharchaRecurring");
export const updateKharchaRecurring = fn(all).mockName("updateKharchaRecurring");
export const setKharchaRecurringPaused = fn(all).mockName("setKharchaRecurringPaused");
export const skipKharchaRecurring = fn(all).mockName("skipKharchaRecurring");
export const deleteKharchaRecurring = fn(all).mockName("deleteKharchaRecurring");
