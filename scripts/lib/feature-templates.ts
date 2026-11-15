/**
 * The templates of `pnpm new:feature` (scripts/templates/feature), rendered: the names a feature's
 * files use, and each template's target path and content. scripts/new-feature.ts writes them;
 * tests/unit/standard/generator.test.ts checks that what they make follows the standard.
 *
 * Paths and contents use the tokens `__name__`, `__snake__`, `__camel__`, `__Pascal__`,
 * `__UPPER__`, `__Title__` and `__TitleNe__`; `{{#flag}}…{{/flag}}` and `{{^flag}}…{{/flag}}`
 * keep text with or without a flag; `*.public.tpl` files exist only with --public.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type FeatureFlags = { public: boolean; localized: boolean };
export type FeatureNames = {
	name: string;
	snake: string;
	camel: string;
	Pascal: string;
	UPPER: string;
	Title: string;
	TitleNe: string;
};

const capital = (word: string) => (word[0]?.toUpperCase() ?? "") + word.slice(1);

/** Every spelling of a kebab-case feature name. Without a Nepali title the English one is marked for translation. */
export function featureNames(feature: string, title?: string, titleNe?: string): FeatureNames {
	const words = feature.split("-");
	const Title = title ?? capital(words.join(" "));
	return {
		name: feature,
		snake: words.join("_"),
		camel: (words[0] ?? "") + words.slice(1).map(capital).join(""),
		Pascal: words.map(capital).join(""),
		UPPER: words.join("_").toUpperCase(),
		Title,
		// Nepali messages must differ from the English ones.
		TitleNe: titleNe ?? `${Title} (अनुवाद गर्नुहोस्)`,
	};
}

/** Keeps `{{#flag}}…{{/flag}}` when the flag is set and `{{^flag}}…{{/flag}}` when it isn't; a tag alone on a line takes the line with it. */
const sections = (text: string, flags: FeatureFlags) => {
	let out = text.replace(/^[ \t]*(\{\{[#^/]\w+\}\})[ \t]*\r?\n/gm, "$1");
	for (;;) {
		const next = out.replace(
			/\{\{([#^])(\w+)\}\}((?:(?!\{\{[#^]\2\}\})[\s\S])*?)\{\{\/\2\}\}/g,
			(_, kind: string, flag: string, inner: string) =>
				(kind === "#") === Boolean(flags[flag as keyof FeatureFlags]) ? inner : "",
		);
		if (next === out) return out;
		out = next;
	}
};

const fill = (text: string, names: FeatureNames) =>
	text
		.replaceAll("__name__", names.name)
		.replaceAll("__snake__", names.snake)
		.replaceAll("__camel__", names.camel)
		.replaceAll("__Pascal__", names.Pascal)
		.replaceAll("__UPPER__", names.UPPER)
		.replaceAll("__TitleNe__", names.TitleNe)
		.replaceAll("__Title__", names.Title);

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((entry) => {
		const full = path.join(dir, entry);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});

/** Every file the templates in `dir` make for a feature: its path from the repository's root, and its content. */
export function renderTemplates(
	dir: string,
	names: FeatureNames,
	flags: FeatureFlags,
): Array<{ target: string; content: string }> {
	return walk(dir)
		.filter((template) => flags.public || !template.endsWith(".public.tpl"))
		.map((template) => ({
			target: fill(path.relative(dir, template).replaceAll("\\", "/"), names).replace(/(\.public)?\.tpl$/, ""),
			content: fill(sections(readFileSync(template, "utf8"), flags), names),
		}));
}
