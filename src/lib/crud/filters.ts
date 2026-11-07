import { chipLabel, type FilterChip, rangeValue } from "@/components/filters/active-filters";
import type { SearchPatch } from "@/components/navigation/search-link";

/**
 * A list's filters as data (docs/guides/crud.md): one chip spec per filter. The
 * chips describe what's applied (each removable), and their keys are what "Clear
 * all" and the filtered empty state reset; sort and page size stay. The controls
 * stay a component, inside <FilterBar>.
 *
 *   export const projectFilters = defineFilters<ProjectSearch>([
 *     textChip("q", m.crud_search),
 *     choiceChip("status", m.projects_filter_status, (status: ProjectStatusFilter) => STATUS_LABELS[status]()),
 *   ]);
 *   <CrudListPage filters={{ controls: <ProjectFilterControls search={search} />, ...projectFilters.applied(search) }} … />
 *
 * `context` is what labels need besides the search (the users list's roles).
 */
export type ChipSpec<TSearch, TContext = unknown> = {
	keys: ReadonlyArray<string>;
	chips: (search: TSearch, context: TContext) => FilterChip[];
};

export function defineFilters<TSearch, TContext = void>(specs: ReadonlyArray<ChipSpec<TSearch, TContext>>) {
	const clearAll: SearchPatch = Object.fromEntries(specs.flatMap((spec) => spec.keys).map((key) => [key, undefined]));
	return {
		clearAll,
		/** What <CrudListPage filters> shows for `search`: one chip per applied filter, and "Clear all". */
		applied: (search: TSearch, context: TContext) => ({
			chips: specs.flatMap((spec) => spec.chips(search, context)),
			clearAll,
		}),
	};
}

/** Free text: "Search: “momo”". */
export const textChip = <K extends string>(key: K, label: () => string): ChipSpec<Record<K, string>> => ({
	keys: [key],
	chips: (search) =>
		search[key] ? [{ id: key, label: chipLabel(label(), `“${search[key]}”`), remove: { [key]: undefined } }] : [],
});

/** One choice: "Status: Draft"; none while the value is `unset` ("all"), or `text` gives nothing. */
export const choiceChip = <K extends string, V extends string, TContext = unknown, U extends string = "all">(
	key: K,
	label: () => string,
	text: (value: V, context: TContext) => string | undefined,
	unset: U = "all" as U,
): ChipSpec<Record<K, V | U>, TContext> => ({
	keys: [key],
	chips: (search, context) => {
		const value = search[key];
		const shown = value === unset ? undefined : text(value as V, context);
		return shown ? [{ id: key, label: chipLabel(label(), shown), remove: { [key]: undefined } }] : [];
	},
});

/** Each selected value of a list, its own chip: "Tags: food", "Tags: nepal". */
export const eachChip = <K extends string>(
	key: K,
	label: () => string,
): ChipSpec<Record<K, ReadonlyArray<string>>> => ({
	keys: [key],
	chips: (search) =>
		search[key].map((value) => ({
			id: `${key}:${value}`,
			label: chipLabel(label(), value),
			remove: { [key]: search[key].filter((other) => other !== value) },
		})),
});

/** A from–to pair, either end optional: "Price: 100 – 500", "Published: from 1 Sep 2026". */
export const rangeChip = <From extends string, To extends string, V>(
	[from, to]: readonly [From, To],
	label: () => string,
	format: (value: V | undefined) => string | undefined,
): ChipSpec<Partial<Record<From | To, V>>> => ({
	keys: [from, to],
	chips: (search) => {
		const value = rangeValue(format(search[from]), format(search[to]));
		return value
			? [{ id: from, label: chipLabel(label(), value), remove: { [from]: undefined, [to]: undefined } }]
			: [];
	},
});

/** A yes/no filter (absent means "any"): the chip is the answer's own text ("With image"). */
export const flagChip = <K extends string>(
	key: K,
	text: (on: boolean) => string,
): ChipSpec<Partial<Record<K, boolean | undefined>>> => ({
	keys: [key],
	chips: (search) => {
		const value = search[key];
		return value === undefined ? [] : [{ id: key, label: text(value), remove: { [key]: undefined } }];
	},
});
