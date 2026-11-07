import { type CsvDateFormat, parseCsvDay } from "@/lib/csv";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { locales } from "@/paraglide/runtime";
import { activeFields, parseFieldCell } from "./fields";
import { IMPORT_ROWS_MAX, type ImportTaskRow, importTaskRow, LABELS_PER_TASK_MAX } from "./schema";
import {
	type FieldValue,
	TASK_PRIORITIES,
	TASK_TYPES,
	type TaskField,
	type TasklineMember,
	type TaskPriority,
	type TaskType,
} from "./types";

/**
 * The CSV import of tasks, its middle step (Task 51, Expenses' pattern, decision
 * 0192): a parsed table, the columns mapped and the date format → one preview row
 * per line, each an import row (checked by the same Zod schema the server uses) or
 * its problems. Pure, so it's unit-tested and the server's check can't disagree.
 * Names (a status, an assignee, labels) are passed as written: the server matches
 * them, and the dialog says beforehand which match nothing.
 */

export const TASK_IMPORT_FIELDS = [
	"title",
	"description",
	"status",
	"assignee",
	"priority",
	"type",
	"labels",
	"start",
	"due",
] as const;
export type TaskImportField = (typeof TASK_IMPORT_FIELDS)[number];

/** Which column (0-based) holds each field; null is "not in the file" (the title is required). */
export type TaskImportMapping = Record<TaskImportField, number | null>;
export type TaskImportOptions = { header: boolean; dateFormat: CsvDateFormat };
/** A problem with a cell: one of the task's fields, or (`custom`) a custom field, named. */
export type TaskImportProblem = { field: TaskImportField | "custom"; name?: string; message: string };
/** Task 55: which column holds each custom field (by field id); null or missing: not in the file. */
export type FieldImportMapping = Record<string, number | null>;
/** What custom fields' cells need: the project's fields, its members (by name), and their columns. */
export type FieldImportContext = {
	fields: ReadonlyArray<TaskField>;
	members: ReadonlyArray<Pick<TasklineMember, "id" | "name">>;
	mapping: FieldImportMapping;
};
export type TaskPreviewRow = {
	/** The row's number in the file, 1-based (the header is row 1). */
	line: number;
	row: ImportTaskRow | null;
	problems: TaskImportProblem[];
};

/** Each field's name in the task's form (and the list's CSV export), in every language. */
const FIELD_MESSAGES = {
	title: m.taskline_field_title,
	description: m.taskline_field_description,
	status: m.taskline_field_status,
	assignee: m.taskline_field_assignee,
	priority: m.taskline_field_priority,
	type: m.taskline_field_type,
	labels: m.taskline_field_labels,
	start: m.taskline_field_start,
	due: m.taskline_field_due,
} satisfies Record<TaskImportField, unknown>;

/** Other header names each field is recognized by (other tools' exports). */
const HEADER_NAMES: Record<TaskImportField, ReadonlyArray<string>> = {
	title: ["name", "task", "summary", "subject"],
	description: ["details", "notes", "body"],
	status: ["state", "column", "list"],
	assignee: ["assigned to", "owner", "who"],
	priority: [],
	type: ["kind", "issue type"],
	labels: ["label", "tags", "tag"],
	start: ["start", "starts", "start on"],
	due: ["due", "deadline", "due on", "end date"],
};

/** A first guess from the header row: each field takes the first column named like it. */
export function guessTaskMapping(header: ReadonlyArray<string>): TaskImportMapping {
	const names = header.map((cell) => cell.trim().toLowerCase());
	const find = (field: TaskImportField) => {
		const known = [
			field,
			...HEADER_NAMES[field],
			...locales.map((locale) => FIELD_MESSAGES[field]({}, { locale }).toLowerCase()),
		];
		const index = names.findIndex((name) => known.includes(name));
		return index === -1 ? null : index;
	};
	return Object.fromEntries(TASK_IMPORT_FIELDS.map((field) => [field, find(field)])) as TaskImportMapping;
}

/** Each offered custom field takes the first column named like it (any case). */
export function guessFieldMapping(header: ReadonlyArray<string>, fields: ReadonlyArray<TaskField>): FieldImportMapping {
	const names = header.map((cell) => cell.trim().toLowerCase());
	return Object.fromEntries(
		activeFields(fields).map((field) => {
			const index = names.indexOf(field.name.toLowerCase());
			return [field.id, index === -1 ? null : index];
		}),
	);
}

const PRIORITY_MESSAGES = {
	0: m.taskline_priority_none,
	1: m.taskline_priority_low,
	2: m.taskline_priority_medium,
	3: m.taskline_priority_high,
	4: m.taskline_priority_urgent,
} satisfies Record<TaskPriority, unknown>;

const TYPE_MESSAGES = {
	task: m.taskline_type_task,
	bug: m.taskline_type_bug,
	story: m.taskline_type_story,
	epic: m.taskline_type_epic,
} satisfies Record<TaskType, unknown>;

/** "3", "high", "उच्च" → 3; "" → 0 (none); null when it isn't a priority. */
export function parsePriority(text: string): TaskPriority | null {
	const value = text.trim().toLowerCase();
	if (value === "") return 0;
	if (/^[0-4]$/.test(value)) return Number(value) as TaskPriority;
	for (const priority of TASK_PRIORITIES) {
		if (locales.some((locale) => PRIORITY_MESSAGES[priority]({}, { locale }).toLowerCase() === value)) return priority;
	}
	return null;
}

/** "bug", "Story", "बग" → the type; "" → null (the project's default); undefined when it isn't one. */
export function parseType(text: string): TaskType | null | undefined {
	const value = text.trim().toLowerCase();
	if (value === "") return null;
	return TASK_TYPES.find(
		(type) => type === value || locales.some((locale) => TYPE_MESSAGES[type]({}, { locale }).toLowerCase() === value),
	);
}

/** "design, web; urgent" → ["design", "web", "urgent"], each once (any case), at most ten. */
export const parseLabels = (text: string): string[] => {
	const seen = new Set<string>();
	const labels: string[] = [];
	for (const name of text.split(/[,;|]/).map((part) => part.trim())) {
		if (!name || seen.has(name.toLowerCase())) continue;
		seen.add(name.toLowerCase());
		labels.push(name);
	}
	return labels.slice(0, LABELS_PER_TASK_MAX);
};

const FIELD_OF: Record<Exclude<keyof ImportTaskRow, "fields">, TaskImportField> = {
	title: "title",
	description: "description",
	status: "status",
	assignee: "assignee",
	priority: "priority",
	type: "type",
	labels: "labels",
	startOn: "start",
	dueOn: "due",
};

/** Every line of the table (after the header), as an import row or its problems. */
export function previewTaskImport(
	table: ReadonlyArray<ReadonlyArray<string>>,
	mapping: TaskImportMapping,
	options: TaskImportOptions,
	custom?: FieldImportContext,
): TaskPreviewRow[] {
	const body = options.header ? table.slice(1) : table;
	const first = options.header ? 2 : 1;
	return body.map((cells, offset): TaskPreviewRow => {
		const cell = (field: TaskImportField) => {
			const column = mapping[field];
			return column === null ? "" : (cells[column] ?? "").trim();
		};
		const problems: TaskImportProblem[] = [];
		const priority = parsePriority(cell("priority"));
		if (priority === null) problems.push({ field: "priority", message: m.taskline_import_error_priority() });
		const type = parseType(cell("type"));
		if (type === undefined) problems.push({ field: "type", message: m.taskline_import_error_type() });
		const day = (field: "start" | "due") => {
			const text = cell(field);
			if (text === "") return null;
			const parsed = parseCsvDay(text, options.dateFormat);
			if (!parsed) problems.push({ field, message: m.taskline_import_error_date() });
			return parsed;
		};
		const candidate = {
			title: cell("title"),
			description: cell("description"),
			type: type ?? null,
			status: cell("status"),
			assignee: cell("assignee"),
			priority: priority ?? 0,
			labels: parseLabels(cell("labels")),
			startOn: day("start"),
			dueOn: day("due"),
		};
		// Task 55: each mapped custom field's cell, typed here (options and members matched by name).
		const values: Record<string, FieldValue> = {};
		for (const field of activeFields(custom?.fields ?? [])) {
			const column = custom?.mapping[field.id] ?? null;
			if (column === null) continue;
			const parsedCell = parseFieldCell(field, cells[column] ?? "", {
				dateFormat: options.dateFormat,
				members: custom?.members ?? [],
			});
			if ("problem" in parsedCell) problems.push({ field: "custom", name: field.name, message: parsedCell.problem });
			else if (parsedCell.value !== null) values[field.id] = parsedCell.value;
		}
		const parsed = importTaskRow.safeParse(
			Object.keys(values).length > 0 ? { ...candidate, fields: values } : candidate,
		);
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				const key = issue.path[0];
				const field =
					typeof key === "string" && key in FIELD_OF
						? FIELD_OF[key as Exclude<keyof ImportTaskRow, "fields">]
						: "title";
				problems.push({ field, message: issue.message });
			}
		}
		return {
			line: first + offset,
			row: parsed.success && problems.length === 0 ? parsed.data : null,
			problems,
		};
	});
}

/** Why the table can't be imported at all (no rows, too many), or null. */
export function taskTableProblem(
	table: ReadonlyArray<ReadonlyArray<string>>,
	options: Pick<TaskImportOptions, "header">,
) {
	const rows = table.length - (options.header ? 1 : 0);
	if (rows <= 0) return m.taskline_import_error_empty();
	if (rows > IMPORT_ROWS_MAX) return m.taskline_import_error_rows({ max: formatNumber(IMPORT_ROWS_MAX) });
	return null;
}

/** The names in the rows that match nothing in the project (they'll be left blank), for the preview's warning. */
export function unmatchedNames(
	rows: ReadonlyArray<ImportTaskRow>,
	known: { statuses: ReadonlyArray<string>; assignees: ReadonlyArray<string>; labels: ReadonlyArray<string> },
) {
	const lower = (names: ReadonlyArray<string>) => new Set(names.map((name) => name.toLowerCase()));
	const statuses = lower(known.statuses);
	const assignees = lower(known.assignees);
	const labels = lower(known.labels);
	const missing = { statuses: new Set<string>(), assignees: new Set<string>(), labels: new Set<string>() };
	for (const row of rows) {
		if (row.status && !statuses.has(row.status.toLowerCase())) missing.statuses.add(row.status);
		if (row.assignee && !assignees.has(row.assignee.toLowerCase())) missing.assignees.add(row.assignee);
		for (const label of row.labels) if (!labels.has(label.toLowerCase())) missing.labels.add(label);
	}
	return { statuses: [...missing.statuses], assignees: [...missing.assignees], labels: [...missing.labels] };
}
