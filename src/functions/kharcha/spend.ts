import { createServerFn } from "@tanstack/react-start";
import {
	bulkInput,
	importInput,
	listIdInput,
	renameSearchInput,
	reorderInput,
	savedSearchInput,
	spendExportInput,
} from "@/features/kharcha/schema";
import { spendChartInput } from "@/features/kharcha/search";
import type { BulkResult, ImportResult, SavedSearch, SpendChart, SpendExportRow } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import { bulkExpenses } from "@/server/kharcha/spend/bulk";
import { importSpend } from "@/server/kharcha/spend/import";
import { deleteSearch, renameSearch, reorderSearches, saveSearch } from "@/server/kharcha/spend/saved";
import { exportSpend, spendChart } from "@/server/kharcha/spend/service";

/**
 * Spend's own functions (Task 93): the chart, the CSV, bulk actions, saved searches and
 * the import. Anyone signed in, guests included (`requireKharchaUser`); each works on the
 * caller's own rows (the access matrix: tests/server/kharcha-access.test.ts).
 */

export const getKharchaSpendChart = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(spendChartInput))
	.handler(({ data, context }): Promise<SpendChart> => spendChart(context, data));

/** The search, or the rows chosen, as CSV lines (POST: a selection's ids don't fit an address). */
export const exportKharchaSpend = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(spendExportInput))
	.handler(({ data, context }): Promise<SpendExportRow[]> => exportSpend(context, data));

export const bulkKharchaExpenses = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(bulkInput))
	.handler(({ data, context }): Promise<BulkResult> => bulkExpenses(context, data));

export const saveKharchaSearch = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(savedSearchInput))
	.handler(({ data, context }): Promise<SavedSearch[]> => saveSearch(context, data));

export const renameKharchaSearch = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(renameSearchInput))
	.handler(({ data, context }): Promise<SavedSearch[]> => renameSearch(context, data));

export const reorderKharchaSearches = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(reorderInput))
	.handler(({ data, context }): Promise<SavedSearch[]> => reorderSearches(context, data.ids));

export const deleteKharchaSearch = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(listIdInput))
	.handler(({ data, context }): Promise<SavedSearch[]> => deleteSearch(context, data.id));

/** A CSV's rows, once per idempotency key. */
export const importKharchaSpend = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(importInput))
	.handler(({ data, context }): Promise<ImportResult> => importSpend(context, data));
