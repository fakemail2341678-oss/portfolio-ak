import { describe, expect, it } from "vitest";
import {
	guessTaskMapping,
	parseLabels,
	parsePriority,
	parseType,
	previewTaskImport,
	taskTableProblem,
	unmatchedNames,
} from "@/features/taskline/import";
import { parseCsv } from "@/lib/csv";

/** Taskline's CSV import, its middle step (Task 51): the mapping's guess, the cells, the preview by the server's schema. */
describe("the task import", () => {
	it("guesses the columns from the list's export (either language) and other tools' headers", () => {
		expect(guessTaskMapping(["Ref", "Title", "Status", "Assignee", "Priority", "Labels", "Due date"])).toMatchObject({
			title: 1,
			status: 2,
			assignee: 3,
			priority: 4,
			labels: 5,
			due: 6,
			description: null,
		});
		expect(guessTaskMapping(["शीर्षक", "स्थिति", "म्याद"])).toMatchObject({ title: 0, status: 1, due: 2 });
		expect(guessTaskMapping(["Summary", "Deadline", "Tags", "Owner"])).toMatchObject({
			title: 0,
			due: 1,
			labels: 2,
			assignee: 3,
		});
	});

	it("reads priorities, types and labels in either language", () => {
		expect(parsePriority("")).toBe(0);
		expect(parsePriority("3")).toBe(3);
		expect(parsePriority("Urgent")).toBe(4);
		expect(parsePriority("9")).toBeNull();
		expect(parseType("Bug")).toBe("bug");
		expect(parseType("")).toBeNull();
		expect(parseType("chore")).toBeUndefined();
		expect(parseLabels("design, Web; design | ")).toEqual(["design", "Web"]);
	});

	it("previews each line as a row or its problems", () => {
		const table = parseCsv(
			"Title,Priority,Type,Due date,Labels\nWrite the brief,high,story,30/11/2026,copy\n,low,,,\nShip it,9,chore,2026-13-01,",
		);
		const mapping = guessTaskMapping(table[0] ?? []);
		const rows = previewTaskImport(table, mapping, { header: true, dateFormat: "dmy" });
		expect(rows[0]).toMatchObject({
			line: 2,
			row: { title: "Write the brief", priority: 3, type: "story", dueOn: "2026-11-30", labels: ["copy"] },
			problems: [],
		});
		expect(rows[1]?.row).toBeNull();
		expect(rows[1]?.problems.map((problem) => problem.field)).toEqual(["title"]);
		expect(rows[2]?.problems.map((problem) => problem.field).sort()).toEqual(["due", "priority", "type"]);
		expect(taskTableProblem(table, { header: true })).toBeNull();
		expect(taskTableProblem(table.slice(0, 1), { header: true })).not.toBeNull();
	});

	it("says which names match nothing in the project", () => {
		const table = parseCsv("title,status,assignee,labels\nA,doing,asha,Design\nB,To do,Nobody,");
		const valid = previewTaskImport(table, guessTaskMapping(table[0] ?? []), {
			header: true,
			dateFormat: "ymd",
		}).flatMap((row) => (row.row ? [row.row] : []));
		expect(unmatchedNames(valid, { statuses: ["To do"], assignees: ["Asha"], labels: ["design"] })).toEqual({
			statuses: ["doing"],
			assignees: ["Nobody"],
			labels: [],
		});
	});
});
