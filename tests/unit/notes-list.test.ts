import { describe, expect, it } from "vitest";
import { visibleNotes } from "@/features/apps/notes/list";
import type { NoteSummary } from "@/features/apps/notes/types";

/** Which notes /apps/notes shows, in which order (decision 0190). */
const note = (id: string, extra: Partial<NoteSummary> = {}): NoteSummary => ({
	id,
	title: id,
	excerpt: "",
	tags: [],
	pinned: false,
	archived: false,
	shared: false,
	cover: null,
	updatedAt: "2026-10-01T00:00:00.000Z",
	...extra,
});

const NOTES = [
	note("old", { updatedAt: "2026-09-01T00:00:00.000Z", tags: ["trek"] }),
	note("new", { updatedAt: "2026-10-20T00:00:00.000Z" }),
	note("pinned", { pinned: true, updatedAt: "2026-08-01T00:00:00.000Z", tags: ["trek"] }),
	note("archived", { archived: true, tags: ["trek"] }),
];
const ids = (notes: NoteSummary[]) => notes.map((each) => each.id);

describe("visibleNotes", () => {
	it("shows pinned notes first, then the most recently changed", () => {
		expect(ids(visibleNotes(NOTES, { view: "notes", tag: "" }, null))).toEqual(["pinned", "new", "old"]);
	});

	it("keeps the archive apart", () => {
		expect(ids(visibleNotes(NOTES, { view: "archive", tag: "" }, null))).toEqual(["archived"]);
	});

	it("filters by one tag", () => {
		expect(ids(visibleNotes(NOTES, { view: "notes", tag: "trek" }, null))).toEqual(["pinned", "old"]);
	});

	it("orders a search's matches by rank, pinned or not, within the view", () => {
		expect(ids(visibleNotes(NOTES, { view: "notes", tag: "" }, ["old", "archived", "pinned"]))).toEqual([
			"old",
			"pinned",
		]);
		expect(visibleNotes(NOTES, { view: "notes", tag: "" }, [])).toEqual([]);
	});
});
