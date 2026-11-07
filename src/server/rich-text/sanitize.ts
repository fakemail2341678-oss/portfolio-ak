import sanitizeHtml from "sanitize-html";
import type { SafeHtml } from "@/lib/safe-html";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isMention = (attribs: Record<string, string>) =>
	attribs["data-type"] === "mention" && UUID.test(attribs["data-id"] ?? "");

/**
 * Allowlist matching exactly what the RichTextField toolbar can produce
 * (StarterKit with h2/h3 and links). Disallowed tags are unwrapped (their text
 * kept); script/style/textarea contents are dropped entirely (sanitize-html's
 * default nonTextTags).
 */
const OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		"p",
		"br",
		"strong",
		"em",
		"u",
		"s",
		"code",
		"pre",
		"h2",
		"h3",
		"ul",
		"ol",
		"li",
		"blockquote",
		"hr",
		"a",
		"span",
	],
	// rel/target are listed because transformTags runs before attribute filtering;
	// the transform overwrites any values the input carried.
	// A span is only ever a mention node (Taskline's comments, Task 50): `data-type="mention"`
	// with a member's id and name; any other span is unwrapped below.
	allowedAttributes: {
		a: ["href", "rel", "target"],
		ol: ["start"],
		span: ["data-type", "data-id", "data-label", "class"],
	},
	allowedClasses: { span: ["mention"] },
	allowedSchemes: ["http", "https", "mailto"],
	allowedSchemesAppliedToAttributes: ["href"],
	allowProtocolRelative: false,
	disallowedTagsMode: "discard",
	transformTags: {
		// Links open in a new tab without leaking the opener or passing ranking.
		a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
	},
	// A link whose href was removed (e.g. javascript:) becomes plain text.
	// A span that isn't a well-formed mention keeps its text and loses the tag.
	exclusiveFilter: (frame) =>
		(frame.tag === "a" && !frame.attribs.href) || (frame.tag === "span" && !isMention(frame.attribs))
			? "excludeTag"
			: false,
};

/**
 * Sanitize rich-text HTML. Call it before storing editor output and again on
 * the server before sending stored HTML to the page (defence in depth against
 * rows written by older code or directly in the database).
 */
export const sanitizeRichText = (html: string): SafeHtml => sanitizeHtml(html, OPTIONS).trim() as SafeHtml;

/**
 * The member ids a sanitized body mentions, in order, each once. Callers keep only
 * those who may see what the body is on (Taskline: the task's project, Task 50).
 *
 * @public
 */
export const mentionedIds = (html: SafeHtml): string[] => {
	const ids = new Set<string>();
	for (const match of html.matchAll(/<span\s[^>]*>/g)) {
		const tag = match[0];
		if (!tag.includes('data-type="mention"')) continue;
		const id = /\sdata-id="([0-9a-f-]{36})"/i.exec(tag)?.[1];
		if (id) ids.add(id.toLowerCase());
	}
	return [...ids];
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

/**
 * The visible text of sanitized rich text, one line per block: for search and
 * excerpts (decision 0190). Tags go, entities are decoded, whitespace is collapsed
 * within a line. Used by Notes and Taskline, so it isn't in either layer's markers.
 *
 * @public
 */
export const richTextToText = (html: string): string =>
	sanitizeHtml(html.replace(/<br\s*\/?>|<\/(p|h2|h3|li|blockquote|pre)>/gi, "$&\n"), {
		allowedTags: [],
		allowedAttributes: {},
	})
		.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "")
		.split("\n")
		.map((line) => line.replace(/\s+/g, " ").trim())
		.filter(Boolean)
		.join("\n");
