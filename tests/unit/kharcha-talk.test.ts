import { describe, expect, it } from "vitest";
import {
	commentParts,
	excerptOf,
	mentionAt,
	NOTIFY_DEFAULTS,
	notifyMode,
	parseThread,
	threadKey,
	threadPath,
} from "@/features/kharcha/notifications";

/** Kharcha's comments as text (Task 92): links and mentions found when shown, never stored as markup. */
describe("commentParts", () => {
	const asha = { id: "p-asha", name: "Asha Gurung" };
	const ash = { id: "p-ash", name: "Asha" };

	it("finds http(s) links, leaving the sentence's punctuation outside", () => {
		expect(commentParts("See https://example.com/a?b=1. Then (http://x.test/y)!", [])).toEqual([
			{ type: "text", text: "See " },
			{ type: "link", text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
			{ type: "text", text: ". Then (" },
			{ type: "link", text: "http://x.test/y", href: "http://x.test/y" },
			{ type: "text", text: ")!" },
		]);
		expect(commentParts("javascript:alert(1) and <b>bold</b>", [])).toEqual([
			{ type: "text", text: "javascript:alert(1) and <b>bold</b>" },
		]);
	});

	it("marks the mentioned people only, the longest name first", () => {
		expect(commentParts("@Asha Gurung and @Asha, not @Bikash", [ash, asha])).toEqual([
			{ type: "mention", text: "@Asha Gurung", personId: "p-asha" },
			{ type: "text", text: " and " },
			{ type: "mention", text: "@Asha", personId: "p-ash" },
			{ type: "text", text: ", not @Bikash" },
		]);
	});
});

describe("mentionAt", () => {
	it("is the @word at the caret, after a space or at the start", () => {
		expect(mentionAt("Hi @As", 6)).toEqual({ start: 3, query: "As" });
		expect(mentionAt("@", 1)).toEqual({ start: 0, query: "" });
		expect(mentionAt("mail@example", 12)).toBeNull();
		expect(mentionAt("no at here", 10)).toBeNull();
		expect(mentionAt("@Asha\nnext", 10)).toBeNull();
	});
});

describe("threads and settings", () => {
	it("names a thread from the reader's side, with its page", () => {
		const key = threadKey("f", "3f1c2a9e-8b7d-4c6e-9a5f-1d2e3c4b5a69");
		expect(parseThread(key)).toEqual({ kind: "f", id: "3f1c2a9e-8b7d-4c6e-9a5f-1d2e3c4b5a69" });
		expect(threadPath(key)).toBe("/app/kharcha/f/3f1c2a9e-8b7d-4c6e-9a5f-1d2e3c4b5a69");
		expect(threadPath(threadKey("g", "g1"))).toBe("/app/kharcha/g/g1");
		expect(threadPath(threadKey("e", "e1"))).toBe("/app/kharcha/e/e1");
	});

	it("emails at once only added-you, payments and reminders by default; a stored choice wins; nonsense doesn't", () => {
		expect(Object.entries(NOTIFY_DEFAULTS).filter(([, mode]) => mode === "instant")).toEqual([
			["group.added", "instant"],
			["payment.received", "instant"],
			["reminder", "instant"],
		]);
		expect(notifyMode({ "expense.added": "instant" }, "expense.added")).toBe("instant");
		expect(notifyMode({ "expense.added": "loud" }, "expense.added")).toBe("digest");
	});

	it("quotes a comment's start on one line", () => {
		expect(excerptOf("  two\n\nlines  ")).toBe("two lines");
		expect(excerptOf("x".repeat(200), 10)).toBe(`${"x".repeat(9)}…`);
	});
});
