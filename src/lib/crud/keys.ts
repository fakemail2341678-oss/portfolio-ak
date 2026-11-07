/**
 * A feature's Query keys, one shape everywhere (docs/guides/crud.md):
 *
 *   ["projects"]                       all: every query of the feature (invalidated after a write)
 *   ["projects", "list"]               lists(): every list page (optimistic updates patch these)
 *   ["projects", "list", input]        list(input): one page
 *   ["projects", "detail"]             details()
 *   ["projects", "detail", id]         detail(id)
 *
 * Add the feature's own keys under `all` (tags, options):
 *
 *   const keys = createCrudKeys<ProjectListInput>("projects");
 *   export const projectKeys = { ...keys, tags: () => [...keys.all, "tags"] as const };
 *
 * Admin data isn't translated, so keys don't include the locale.
 */
export function createCrudKeys<TListInput, const TName extends string = string>(name: TName) {
	const all = [name] as const;
	return {
		all,
		lists: () => [name, "list"] as const,
		list: (input: TListInput) => [name, "list", input] as const,
		details: () => [name, "detail"] as const,
		detail: (id: string) => [name, "detail", id] as const,
	};
}
