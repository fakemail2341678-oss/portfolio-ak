import { defaultParseSearch, defaultStringifySearch } from "@tanstack/react-router";

/**
 * Router search serialization (src/router.tsx): the defaults, except that
 * arrays of plain values become repeated keys (`tags=a&tags=b`), the format
 * HTML forms submit. Parsing already reads repeated keys as arrays.
 */
export function stringifySearch(search: Record<string, unknown>): string {
	const arrays: Array<[string, unknown[]]> = [];
	const rest: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(search)) {
		const plain =
			Array.isArray(value) &&
			value.every((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean");
		if (plain) arrays.push([key, value]);
		else rest[key] = value;
	}
	const params = new URLSearchParams(defaultStringifySearch(rest));
	for (const [key, values] of arrays) for (const value of values) params.append(key, String(value));
	const query = params.toString();
	return query ? `?${query}` : "";
}

export const parseSearch = defaultParseSearch;

/**
 * The search patch for a filter form: every named control becomes a key, with
 * repeated names collected into arrays and empty values removed (undefined, so
 * the key disappears from the URL). Mirrors what the browser submits without JS.
 */
export function formSearchPatch(form: HTMLFormElement, { exclude = [] }: { exclude?: ReadonlyArray<string> } = {}) {
	const names = new Set<string>();
	for (const element of Array.from(form.elements)) {
		const name = (element as HTMLInputElement).name;
		if (name && !exclude.includes(name)) names.add(name);
	}
	const data = new FormData(form);
	const patch: Record<string, unknown> = {};
	for (const name of names) {
		const values = data.getAll(name).filter((value): value is string => typeof value === "string" && value !== "");
		// Checkboxes, or several controls of one name (a select per custom field, all `cf`), make a list.
		const named = Array.from(form.elements).filter((element) => (element as HTMLInputElement).name === name);
		const multiple = named.length > 1 || named.some((element) => (element as HTMLInputElement).type === "checkbox");
		patch[name] = multiple ? values : values[0];
	}
	return patch;
}
