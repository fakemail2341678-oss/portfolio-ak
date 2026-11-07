/**
 * The demo content in the database's shape (decision 0176): case-study blocks
 * with ids and `type`, articles as rich-text HTML per language. Pure, so the
 * seed (./portfolio-seed.ts) and the portfolio's stories share it.
 */
import type { CaseStudyBlock, Localized, ProseBlock } from "./portfolio-data/types.ts";

const EMPTY: Localized = { en: "", ne: "" };

/** One case-study block as stored: an id and `type` (BlocksField), edges as `{ from, to }`. */
function storedBlock(block: CaseStudyBlock, index: number) {
	const id = `block-${index + 1}`;
	switch (block.kind) {
		case "chapter":
			return { id, type: "chapter" as const, title: block.title, body: block.body };
		case "quote":
			return { id, type: "quote" as const, text: block.text, cite: block.cite ?? "" };
		case "code":
			return { id, type: "code" as const, language: block.language, caption: block.caption ?? EMPTY, code: block.code };
		case "architecture":
			return {
				id,
				type: "architecture" as const,
				caption: block.caption,
				nodes: block.nodes,
				edges: block.edges.map(([from, to]) => ({ from, to })),
			};
		case "gallery":
			return { id, type: "gallery" as const, captions: block.captions };
	}
}

/** Case-study blocks as stored. */
export const toStoredBlocks = (blocks: ReadonlyArray<CaseStudyBlock>) => blocks.map(storedBlock);

const escapeHtml = (text: string) =>
	text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

/** One prose block as the editor's HTML in `language`. */
function proseBlockHtml(block: ProseBlock, language: keyof Localized): string {
	const text = (value: Localized) => escapeHtml(value[language]);
	switch (block.kind) {
		case "paragraph":
			return `<p>${text(block.text)}</p>`;
		case "heading":
			return `<h2>${text(block.text)}</h2>`;
		case "quote":
			return `<blockquote><p>${text(block.text)}</p>${block.cite ? `<p>${escapeHtml(block.cite)}</p>` : ""}</blockquote>`;
		case "code":
			return `<pre><code>${escapeHtml(block.code)}</code></pre>${block.caption ? `<p><em>${text(block.caption)}</em></p>` : ""}`;
		case "list":
			return `<ul>${block.items.map((item) => `<li><p>${text(item)}</p></li>`).join("")}</ul>`;
	}
}

/** An article's typed prose as the rich-text HTML the journal stores (the editor's tags only). */
export const proseToHtml = (blocks: ReadonlyArray<ProseBlock>, language: keyof Localized): string =>
	blocks.map((block) => proseBlockHtml(block, language)).join("");
