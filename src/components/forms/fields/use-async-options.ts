import { useDebouncedValue } from "@tanstack/react-pacer";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { AsyncSearch } from "./async-combobox-field";
import type { FieldOption } from "./choice-fields";

/** The search results for what's typed, and a memory of every option's label seen so far. */
export function useAsyncOptions(
	{ queryKey, search, debounceMs = 250, selected = [] }: AsyncSearch & { selected?: ReadonlyArray<FieldOption> },
	open: boolean,
) {
	const [query, setQuery] = useState("");
	const [debounced] = useDebouncedValue(query.trim(), { wait: debounceMs });
	const results = useQuery({
		queryKey: [...queryKey, "search", debounced],
		queryFn: () => search(debounced),
		enabled: open,
		placeholderData: keepPreviousData,
		staleTime: 30000,
	});
	const known = useRef(new Map<string, FieldOption>());
	for (const option of [...selected, ...(results.data ?? [])]) known.current.set(option.value, option);
	return {
		query,
		setQuery,
		options: results.data ?? [],
		// Typing ahead of the debounce counts as loading too, so "no results" never flashes.
		loading: results.isFetching || query.trim() !== debounced,
		labelOf: (value: string) => known.current.get(value)?.label ?? value,
	};
}
