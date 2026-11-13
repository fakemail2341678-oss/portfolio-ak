import type { Plugin } from "vite";

/**
 * Drops, from every lazy import's preload list, the chunks the client entry already loads
 * (decision 0291).
 *
 * Vite lists each dynamic import's static dependencies so they can load in parallel, and
 * names every listed file once in the entry's `__vite__mapDeps`. Most lists start with
 * chunks that every page has already loaded before any lazy import can run (React, the
 * router, Query, Zod), so naming them again only adds bytes to the code every page ships:
 * 11,144 of 23,042 listed entries and 3.6 kB gzip of the entry at Task 97.
 *
 * `generateBundle` (order "pre") runs before Vite's own import analysis rewrites the lists
 * in its `generateBundle`, so the entry's static closure is known when `resolveDependencies`
 * is asked. A build without a client entry (the server's) keeps every dependency.
 */
export const entryPreloads = () => {
	const loaded = new Set<string>();

	const plugin: Plugin = {
		name: "entry-preloads",
		apply: "build",
		generateBundle: {
			order: "pre",
			handler(_options, bundle) {
				loaded.clear();
				const queue = Object.values(bundle)
					.filter((output) => output.type === "chunk" && output.isEntry && !output.isDynamicEntry)
					.map((output) => output.fileName);
				while (queue.length > 0) {
					const file = queue.pop() as string;
					if (loaded.has(file)) continue;
					loaded.add(file);
					const output = bundle[file];
					if (output?.type === "chunk") queue.push(...output.imports);
				}
			},
		},
	};

	const resolveDependencies = (_file: string, deps: string[]) => deps.filter((dep) => !loaded.has(dep));

	return { plugin, resolveDependencies };
};
