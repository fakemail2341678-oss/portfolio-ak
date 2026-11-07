import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every <form> declares its method. Forms handled in JavaScript use "post": if
 * one is submitted before hydration (a slow device, a click during load), the
 * browser posts the fields in the body instead of putting them, passwords
 * included, in the URL, the history and server logs. GET is only for forms whose
 * values belong in the URL: FilterBar, and Taskline's search page (Task 51), which
 * searches only when submitted.
 */
const sourceFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return sourceFiles(full);
		return /\.tsx$/.test(entry.name) && !entry.name.endsWith(".stories.tsx") ? [full] : [];
	});

/** Opening <form> tags in JSX; comments that mention "<form>" are skipped. */
const formTags = (source: string) =>
	[
		...source
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "")
			.matchAll(/<form(?=[\s>])[^>]*>/g),
	].map((match) => match[0]);

describe("<form> method", () => {
	const forms = sourceFiles("src").flatMap((file) =>
		formTags(readFileSync(file, "utf8")).map((tag) => ({ file, tag })),
	);

	it("finds the forms", () => {
		expect(forms.length).toBeGreaterThanOrEqual(11);
	});

	it("every form sets method; only FilterBar and the search pages use GET", () => {
		const missing = forms.filter(({ tag }) => !/\bmethod="(post|get)"/.test(tag));
		expect(missing).toEqual([]);
		const gets = forms
			.filter(({ tag }) => tag.includes('method="get"'))
			.map(({ file }) => file.split(path.sep).join("/"));
		expect(gets).toEqual([
			"src/components/filters/filter-bar.tsx",
			"src/features/parda/search/search-page.tsx", // @parda
			"src/features/taskline/find/search-page.tsx", // @taskline
		]);
	});
});
