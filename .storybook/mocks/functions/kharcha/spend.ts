import { fn } from "storybook/test";
import type {
	BulkResult,
	ImportResult,
	SavedSearch,
	SpendChart,
	SpendExportRow,
} from "../../../../src/features/kharcha/types";
import { sampleKharchaMe, sampleKharchaSpendChart } from "../../kharcha";

// Stand-ins for src/functions/kharcha/spend.ts.
const searches = async (): Promise<SavedSearch[]> => sampleKharchaMe.searches;
export const getKharchaSpendChart = fn(async (): Promise<SpendChart> => sampleKharchaSpendChart).mockName(
	"getKharchaSpendChart",
);
export const exportKharchaSpend = fn(async (): Promise<SpendExportRow[]> => []).mockName("exportKharchaSpend");
export const bulkKharchaExpenses = fn(async (): Promise<BulkResult> => ({ changed: 1, skipped: 0 })).mockName(
	"bulkKharchaExpenses",
);
export const saveKharchaSearch = fn(searches).mockName("saveKharchaSearch");
export const renameKharchaSearch = fn(searches).mockName("renameKharchaSearch");
export const reorderKharchaSearches = fn(searches).mockName("reorderKharchaSearches");
export const deleteKharchaSearch = fn(searches).mockName("deleteKharchaSearch");
export const importKharchaSpend = fn(
	async (): Promise<ImportResult> => ({ inserted: 2, categories: 0, tags: 0, methods: 0, replayed: false }),
).mockName("importKharchaSpend");
