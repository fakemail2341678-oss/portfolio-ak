/**
 * The markers `pnpm strip-demo` (scripts/strip-demo.ts) removes code by, one set per layer:
 *
 * - Blocks: a comment line `<layer>:start` … a comment line `<layer>:end`, in any comment
 *   style at the start of the line (`//`, `/*`, `{/*`, `<!--`, `#`). Both lines go too.
 * - Lines: a line ending in `// @<layer>` (imports: Biome keeps a trailing comment on
 *   its line when it sorts them, but moves a comment line above one), or holding an
 *   HTML comment `@<layer>` (Markdown, e.g. at the end of a table row's last cell).
 *
 * Mentions in prose (mid-line, or in backticks) are not markers. The records of past
 * work (PLAN.md, decisions.md, docs/history) are never edited.
 */

export const LAYERS = ["portfolio", "apps", "taskline", "parda", "chaal"] as const;
export type Layer = (typeof LAYERS)[number];

/** Not a layer: what exists only for the script (CI's template job), removed once no layer is left. */
export const TOOL = "strip-demo";

/** Files whose text is a record, not code: never stripped, never checked. */
export const RECORDS = /^docs\/(?:PLAN\.md|decisions\.md|history\/)/;

/** Text files that may hold markers. */
export const TEXT = /\.(?:[cm]?[jt]sx?|css|md|json|ya?ml|html|tpl)$/;

const blockMarker = (layer: string, edge: "start" | "end") =>
	new RegExp(`^\\s*(?://|/\\*|\\{/\\*|<!--|#)\\s*${layer}:${edge}\\b`);
const lineMarker = (layer: string) => new RegExp(`//\\s*@${layer}\\s*$|(?<!\`)<!--\\s*@${layer}\\s*-->(?!\`)`);

/** Problems with a file's markers for one layer (unbalanced or nested blocks). Empty when fine. */
export function markerProblems(content: string, layer: string): string[] {
	const start = blockMarker(layer, "start");
	const end = blockMarker(layer, "end");
	const problems: string[] = [];
	let open: number | null = null;
	for (const [index, line] of content.split("\n").entries()) {
		if (start.test(line)) {
			if (open !== null) problems.push(`line ${index + 1}: ${layer}:start inside the block opened on line ${open}`);
			open = index + 1;
		} else if (end.test(line)) {
			if (open === null) problems.push(`line ${index + 1}: ${layer}:end without ${layer}:start`);
			open = null;
		}
	}
	if (open !== null) problems.push(`line ${open}: ${layer}:start without ${layer}:end`);
	return problems;
}

/** The content without the layer's marked blocks and lines; null when nothing was marked. */
export function stripLayer(content: string, layer: string): string | null {
	const start = blockMarker(layer, "start");
	const end = blockMarker(layer, "end");
	const single = lineMarker(layer);
	const kept: string[] = [];
	let inside = false;
	let found = false;
	for (const line of content.split("\n")) {
		if (start.test(line)) {
			inside = true;
			found = true;
		} else if (end.test(line)) {
			inside = false;
		} else if (single.test(line)) {
			found = true;
		} else if (!inside) {
			kept.push(line);
		}
	}
	return found ? kept.join("\n") : null;
}

/** Part 3's single `demo` layer, converted in Task 35: none may come back. */
export const LEGACY_MARKER =
	/^\s*(?:\/\/|\/\*|\{\/\*|<!--)\s*demo:(?:start|end)\b|\/\/\s*@demo\s*$|(?<!`)<!--\s*@demo\s*-->(?!`)/m;
