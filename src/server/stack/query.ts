import "@tanstack/react-start/server-only";
import { STACK_PAGE_SIZE, type StackItem, type StackPage, type StackSearch } from "@/features/stack/schema";
import { paginateArray } from "@/lib/list/paging";
import type { Locale } from "@/paraglide/runtime";
import { CATEGORY_LABELS, STACK } from "./data";

/** Pure search/sort/paginate over the stack data, in the current message locale. */
export const queryStack = (search: StackSearch, locale: Locale): StackPage => {
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
