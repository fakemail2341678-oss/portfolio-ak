import "@tanstack/react-start/server-only";
import {
	STACK_PAGE_SIZE,
	type StackItem,
	type StackPage,
	type StackSearch,
	type StackStats,
} from "@/features/stack/schema";
import { paginateArray } from "@/lib/list/paging";
import type { Locale } from "@/paraglide/runtime";
import { CATEGORY_LABELS, STACK } from "./data";

/**
 * What `?simulate=error` throws: a failure nobody planned for, with a message that must
 * never reach the browser. Not an AppError on purpose: /dev/stack shows it arrive as INTERNAL.
 */
export class SimulatedFailure extends Error {
	override name = "SimulatedFailure";
}

/** Search, sort and paginate over the stack data, in the current message locale. */
export const queryStack = (search: StackSearch, locale: Locale): StackPage => {
	if (search.simulate === "error") {
		// Deliberately leaky message: the error mapper must hide it from the client.
		throw new SimulatedFailure("Simulated failure: connection to 10.0.0.5:5432 refused (password=hunter2)");
	}
	const collator = new Intl.Collator(locale === "ne" ? "ne" : "en", { sensitivity: "base" });
	const needle = search.q.toLocaleLowerCase();

	const items: StackItem[] = STACK.map((entry) => ({
		id: entry.id,
		name: entry.name,
		category: entry.category,
		categoryLabel: CATEGORY_LABELS[entry.category](),
		description: entry.describe(),
		url: entry.url,
	})).filter(
		(item) =>
			!needle ||
			[item.name, item.description, item.categoryLabel].some((field) => field.toLocaleLowerCase().includes(needle)),
	);

	items.sort((a, b) => {
		if (search.sort === "category") {
			return collator.compare(a.categoryLabel, b.categoryLabel) || collator.compare(a.name, b.name);
		}
		const byName = collator.compare(a.name, b.name);
		return search.sort === "-name" ? -byName : byName;
	});

	// Out-of-range pages are clamped rather than returning an empty page.
	return paginateArray(items, search.page, STACK_PAGE_SIZE);
};

/** Deliberately slow, to demonstrate a deferred loader promise streamed via Suspense. */
export async function slowStats(): Promise<StackStats> {
	// timer: slow on purpose, so /dev/stack shows a deferred value arriving.
	await new Promise((resolve) => setTimeout(resolve, 800));
	return { tools: STACK.length, categories: new Set(STACK.map((entry) => entry.category)).size };
}
