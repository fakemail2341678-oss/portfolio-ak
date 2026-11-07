import { describe, expect, it } from "vitest";
import {
	applyFieldPatch,
	fieldDefinition,
	fieldValueText,
	matchesFieldFilters,
	missingRequired,
	parseFieldCell,
	parseFieldFilters,
	toTaskFieldsSchema,
} from "@/features/taskline/fields";
import { createFieldInput, updateFieldInput } from "@/features/taskline/schema";
import { taskFilterParams } from "@/features/taskline/search";
import type { FieldType, TaskField } from "@/features/taskline/types";

/** Custom fields' pure rules (Task 55): definitions, each type's values, filters, CSV cells. */

const id = (n: number) => `0f1e5e00-0000-4000-8000-00000000000${n}`;
const def = (n: number, type: FieldType, extra: Partial<TaskField> = {}): TaskField => ({
	id: id(n),
	projectId: null,
	name: `Field ${n}`,
	type,
	options:
		type === "select" || type === "multi_select"
			? [
					{ id: "olow001", name: "Low", color: "gray" },
					{ id: "ohigh01", name: "High", color: "red" },
				]
			: [],
	required: false,
	position: `a${n}`,
	archived: false,
	...extra,
});

const fields = [
	def(1, "text"),
	def(2, "number"),
	def(3, "select"),
	def(4, "multi_select"),
	def(5, "date"),
	def(6, "member"),
	def(7, "checkbox"),
	def(8, "url"),
];
const MEMBER = "11111111-1111-4111-8111-111111111111";
const members = [{ id: MEMBER, name: "Asha" }];

describe("definitions", () => {
	it("needs options for a choice, each named once, and none for the other types", () => {
		expect(fieldDefinition.safeParse({ type: "select", name: "Size", required: false, options: [] }).success).toBe(
			false,
		);
		expect(
			fieldDefinition.safeParse({
				type: "select",
				name: "Size",
				required: false,
				options: [
					{ id: "oaaa001", name: "S", color: "gray" },
					{ id: "obbb001", name: "s", color: "gray" },
				],
			}).success,
		).toBe(false);
		expect(
			fieldDefinition.safeParse({ type: "text", name: "Note", required: false, options: [{ id: "oaaa001" }] }).success,
		).toBe(false);
		expect(fieldDefinition.safeParse({ type: "date", name: "Review by", required: true }).success).toBe(true);
		expect(
			createFieldInput.safeParse({ ws: "team", key: "WEB", field: { type: "url", name: "Spec", required: false } })
				.success,
		).toBe(true);
		// A field's type is never an update.
		expect(updateFieldInput.safeParse({ ws: "team", key: "WEB", id: id(1), type: "number" }).success).toBe(false);
		expect(updateFieldInput.safeParse({ ws: "team", key: "WEB", id: id(3), options: [] }).success).toBe(false);
	});
});

describe("values", () => {
	const schema = toTaskFieldsSchema(fields);
	const ok = (values: Record<string, unknown>) => schema.safeParse(values).success;

	it("takes each type's value, or null to clear it", () => {
		expect(
			ok({
				[id(1)]: "Hello",
				[id(2)]: 12.5,
				[id(3)]: "ohigh01",
				[id(4)]: ["olow001", "ohigh01"],
				[id(5)]: "2026-11-03",
				[id(6)]: MEMBER,
				[id(7)]: true,
				[id(8)]: "https://example.com/spec",
			}),
		).toBe(true);
		expect(ok({ [id(1)]: null, [id(3)]: null })).toBe(true);
	});

	it("refuses what a type can't hold, archived fields and unknown ones", () => {
		expect(ok({ [id(1)]: " " })).toBe(false);
		expect(ok({ [id(2)]: "12" })).toBe(false);
		expect(ok({ [id(2)]: Number.POSITIVE_INFINITY })).toBe(false);
		expect(ok({ [id(3)]: "onope01" })).toBe(false);
		expect(ok({ [id(4)]: ["olow001", "olow001"] })).toBe(false);
		expect(ok({ [id(5)]: "2026-02-30" })).toBe(false);
		expect(ok({ [id(6)]: "Asha" })).toBe(false);
		expect(ok({ [id(7)]: false })).toBe(false);
		expect(ok({ [id(8)]: "javascript:alert(1)" })).toBe(false);
		expect(ok({ [id(9)]: "x" })).toBe(false);
		expect(toTaskFieldsSchema([def(1, "text", { archived: true })]).safeParse({ [id(1)]: "x" }).success).toBe(false);
	});

	it("patches some values and keeps the rest; empty ones go", () => {
		expect(applyFieldPatch({ a: "x", b: 2 }, { b: null, c: true, d: [], e: false })).toEqual({ a: "x", c: true });
	});

	it("names what a task needs before it's completed", () => {
		const required = [def(1, "text", { required: true }), def(7, "checkbox", { required: true, archived: true })];
		expect(missingRequired(required, {}).map((field) => field.id)).toEqual([id(1)]);
		expect(missingRequired(required, { [id(1)]: "done" })).toEqual([]);
	});

	it("reads values as words, and as plain text for files", () => {
		expect(fieldValueText(def(4, "multi_select"), ["ohigh01", "olow001"], members)).toBe("High, Low");
		expect(fieldValueText(def(3, "select"), "ogone01", members)).toBe("a removed option");
		expect(fieldValueText(def(6, "member"), MEMBER, members)).toBe("Asha");
		expect(fieldValueText(def(5, "date"), "2026-11-03", members, { csv: true })).toBe("2026-11-03");
		expect(fieldValueText(def(2, "number"), 1500, members, { csv: true })).toBe("1500");
		expect(fieldValueText(def(7, "checkbox"), true, members)).toBe("Yes");
		expect(fieldValueText(def(1, "text"), undefined, members)).toBe("");
	});
});

describe("filters", () => {
	const context = { me: MEMBER, today: "2026-11-03" };
	const task = {
		fields: { [id(3)]: "ohigh01", [id(4)]: ["olow001"], [id(5)]: "2026-11-01", [id(6)]: MEMBER, [id(7)]: true },
	};
	const matches = (...params: string[]) => matchesFieldFilters(task, parseFieldFilters(params), fields, context);

	it("parses `cf` params, one per field", () => {
		expect(parseFieldFilters([`${id(3)}:ohigh01`, `${id(3)}:none`, "junk", `${id(7)}:yes`])).toEqual([
			{ fieldId: id(3), value: "ohigh01" },
			{ fieldId: id(7), value: "yes" },
		]);
		// The URL contract keeps valid ones only.
		expect(taskFilterParams.cf.parse(["nope", `${id(3)}:ohigh01`])).toEqual([`${id(3)}:ohigh01`]);
		expect(taskFilterParams.cf.parse(`${id(3)}:any`)).toEqual([`${id(3)}:any`]);
	});

	it("matches an option, a multiple choice holding it, a person or me, a tick, days and emptiness", () => {
		expect(matches(`${id(3)}:ohigh01`)).toBe(true);
		expect(matches(`${id(3)}:olow001`)).toBe(false);
		expect(matches(`${id(4)}:olow001`)).toBe(true);
		expect(matches(`${id(6)}:me`)).toBe(true);
		expect(matchesFieldFilters(task, parseFieldFilters([`${id(6)}:me`]), fields, { ...context, me: null })).toBe(false);
		expect(matches(`${id(7)}:yes`)).toBe(true);
		expect(matches(`${id(7)}:no`)).toBe(false);
		expect(matches(`${id(5)}:past`)).toBe(true);
		expect(matches(`${id(5)}:future`)).toBe(false);
		expect(matches(`${id(1)}:none`)).toBe(true);
		expect(matches(`${id(1)}:any`)).toBe(false);
		expect(matches(`${id(3)}:ohigh01`, `${id(7)}:no`)).toBe(false);
		// A field no longer offered doesn't filter.
		expect(matchesFieldFilters(task, parseFieldFilters([`${id(9)}:any`]), fields, context)).toBe(true);
	});
});

describe("CSV cells", () => {
	const cell = (field: TaskField, text: string) => parseFieldCell(field, text, { dateFormat: "dmy", members });

	it("turns cells into values: names any case, several options, days in the format, ticks in words", () => {
		expect(cell(def(3, "select"), "high")).toEqual({ value: "ohigh01" });
		expect(cell(def(4, "multi_select"), "High; low")).toEqual({ value: ["ohigh01", "olow001"] });
		expect(cell(def(5, "date"), "03/11/2026")).toEqual({ value: "2026-11-03" });
		expect(cell(def(6, "member"), "asha")).toEqual({ value: MEMBER });
		expect(cell(def(7, "checkbox"), "✓")).toEqual({ value: true });
		expect(cell(def(7, "checkbox"), "हो")).toEqual({ value: true });
		expect(cell(def(7, "checkbox"), "no")).toEqual({ value: null });
		expect(cell(def(2, "number"), "१,५००")).toEqual({ value: 1500 });
		expect(cell(def(1, "text"), "")).toEqual({ value: null });
	});

	it("says what a cell can't be", () => {
		for (const [field, text] of [
			[def(3, "select"), "Medium"],
			[def(5, "date"), "2026-11-03"],
			[def(6, "member"), "Nobody"],
			[def(7, "checkbox"), "maybe"],
			[def(2, "number"), "lots"],
			[def(8, "url"), "not a link"],
		] as const) {
			expect(cell(field, text)).toHaveProperty("problem");
		}
	});
});
