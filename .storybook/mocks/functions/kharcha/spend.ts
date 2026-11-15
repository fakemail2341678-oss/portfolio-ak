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
export const updateKharchaExpenses = fn(async (): Promise<BulkResult> => ({ changed: 1, skipped: 0 })).mockName(
	"updateKharchaExpenses",
);
export const createKharchaSearch = fn(searches).mockName("createKharchaSearch");
export const setKharchaSearchName = fn(searches).mockName("setKharchaSearchName");
export const reorderKharchaSearches = fn(searches).mockName("reorderKharchaSearches");
export const deleteKharchaSearch = fn(searches).mockName("deleteKharchaSearch");
export const importKharchaSpend = fn(
	async (): Promise<ImportResult> => ({ inserted: 2, categories: 0, tags: 0, methods: 0, replayed: false }),
).mockName("importKharchaSpend");
