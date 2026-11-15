import { exportKharchaSpend } from "@/functions/kharcha/spend";
import type { SpendExportInput } from "../schema";

/** The search, or the rows chosen, as CSV lines (Task 93): the page makes the file. */
export const exportKharcha = (data: SpendExportInput) => exportKharchaSpend({ data });
