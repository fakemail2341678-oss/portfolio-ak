import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, CheckCircle2Icon, FileUpIcon, TriangleAlertIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { type CsvSource, CsvSourcePicker, csvColumnNames } from "@/components/forms/csv-source";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { CSV_DATE_FORMATS, type CsvDateFormat } from "@/lib/csv";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { activeFields } from "../fields";
import {
	type FieldImportMapping,
	guessFieldMapping,
	guessTaskMapping,
	previewTaskImport,
	TASK_IMPORT_FIELDS,
	type TaskImportField,
	type TaskImportMapping,
	type TaskImportOptions,
	type TaskImportProblem,
	taskTableProblem,
	unmatchedNames,
} from "../import";
import { PRIORITY_LABELS, TYPE_LABELS } from "../labels";
import { tasklineMutations } from "../queries";
import type { ProjectTasks, TaskField } from "../types";

/** Rows shown in the preview table (every problem is listed below it). */
const PREVIEW_ROWS = 10;
const PROBLEM_ROWS = 30;

const FIELD_LABELS: Record<TaskImportField, () => string> = {
	title: m.taskline_field_title,
	description: m.taskline_field_description,
	status: m.taskline_field_status,
	assignee: m.taskline_field_assignee,
	priority: m.taskline_field_priority,
	type: m.taskline_field_type,
	labels: m.taskline_field_labels,
	start: m.taskline_field_start,
	due: m.taskline_field_due,
};

const DATE_FORMAT_LABELS: Record<CsvDateFormat, () => string> = {
	ymd: m.csv_format_ymd,
	dmy: m.csv_format_dmy,
	mdy: m.csv_format_mdy,
};

/**
 * Import tasks from CSV into a project (Task 51; Expenses' three steps, decision
 * 0192): a file or pasted text, which column is which (guessed from the header), and
 * a preview checked by the server's own schema, with the names that match nothing in
 * the project. Only valid rows are sent, once: the idempotency key is made with each
 * preview, so a double click or a retry can't import twice. Loaded when opened.
 */
export default function ImportDialog({
	userId,
	ws,
	project,
	onClose,
}: {
	userId: string;
	ws: string;
	project: ProjectTasks;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const save = useMutation(tasklineMutations.importTasks(queryClient, userId));
	const [source, setSource] = useState<CsvSource | null>(null);
	const [mapping, setMapping] = useState<TaskImportMapping | null>(null);
	const [fieldMapping, setFieldMapping] = useState<FieldImportMapping>({});
	const [options, setOptions] = useState<TaskImportOptions>({ header: true, dateFormat: "ymd" });
	// One key per preview: anything that changes the rows makes a new one (an import of other rows).
	const [idempotencyKey, setKey] = useState(() => crypto.randomUUID());

	const load = (loaded: CsvSource | null) => {
		setSource(loaded);
		setMapping(loaded ? guessTaskMapping(loaded.table[0] ?? []) : null);
		setFieldMapping(loaded ? guessFieldMapping(loaded.table[0] ?? [], project.fields) : {});
		setKey(crypto.randomUUID());
	};
	const changeMapping = (field: TaskImportField, column: number | null) => {
		setMapping((current) => (current ? { ...current, [field]: column } : current));
		setKey(crypto.randomUUID());
	};
	const changeFieldMapping = (fieldId: string, column: number | null) => {
		setFieldMapping((current) => ({ ...current, [fieldId]: column }));
		setKey(crypto.randomUUID());
	};
	const changeOptions = (patch: Partial<TaskImportOptions>) => {
		setOptions((current) => ({ ...current, ...patch }));
		setKey(crypto.randomUUID());
	};

	const problem = source ? taskTableProblem(source.table, options) : null;
	const ready = mapping !== null && mapping.title !== null;
	const rows =
		source && ready && !problem
			? previewTaskImport(source.table, mapping, options, {
					fields: project.fields,
					members: project.members.filter((member) => !member.deactivated),
					mapping: fieldMapping,
				})
			: [];
	const valid = rows.flatMap((row) => (row.row ? [row.row] : []));
	const invalid = rows.filter((row) => !row.row);
	const missing = unmatchedNames(valid, {
		statuses: project.statuses.map((status) => status.name),
		assignees: project.members.filter((member) => !member.deactivated).map((member) => member.name),
		labels: project.labels.map((label) => label.name),
	});

	const submit = () =>
		save.mutate(
			{ ws, key: project.project.key, idempotencyKey, rows: valid },
			{
				onSuccess: (result) => {
					toast.success(m.taskline_import_done({ count: formatNumber(result.inserted) }));
					onClose();
				},
				onError: (failure) => toast.error(m.common_toast_failed(), { description: errorMessage(failure) }),
			},
		);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl" data-testid="import-dialog">
				<DialogHeader>
					<DialogTitle>{m.taskline_import_title({ project: project.project.name })}</DialogTitle>
					<DialogDescription>{m.taskline_import_description()}</DialogDescription>
				</DialogHeader>
				<div className="flex min-w-0 flex-col gap-6">
					<CsvSourcePicker
						hint={m.taskline_import_hint()}
						placeholder={"title,status,assignee,due\nWrite the brief,To do,Asha,2026-11-20"}
						onLoad={load}
					/>
					{source && mapping ? (
						<Columns
							table={source.table}
							mapping={mapping}
							options={options}
							onMapping={changeMapping}
							onOptions={changeOptions}
							fields={activeFields(project.fields)}
							fieldMapping={fieldMapping}
							onFieldMapping={changeFieldMapping}
						/>
					) : null}
					{source && mapping ? (
						<div className="flex flex-col gap-4">
							{problem ? (
								<Alert variant="destructive">
									<AlertCircleIcon aria-hidden />
									<AlertDescription>{problem}</AlertDescription>
								</Alert>
							) : !ready ? (
								<p className="text-muted-foreground text-sm">{m.taskline_import_map_title()}</p>
							) : (
								<Preview rows={rows} validCount={valid.length} missing={missing} />
							)}
							<div className="flex flex-wrap items-center justify-end gap-3">
								{invalid.length > 0 && valid.length > 0 ? (
									<span className="me-auto text-muted-foreground text-sm">
										{m.taskline_import_skipping({ count: formatNumber(invalid.length) })}
									</span>
								) : null}
								<Button variant="outline" onClick={onClose}>
									{m.common_cancel()}
								</Button>
								<Button onClick={submit} disabled={valid.length === 0 || save.isPending} data-testid="import-submit">
									<FileUpIcon aria-hidden />
									{m.taskline_import_submit({ count: formatNumber(valid.length) })}
								</Button>
							</div>
						</div>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function Columns({
	table,
	mapping,
	options,
	onMapping,
	onOptions,
	fields,
	fieldMapping,
	onFieldMapping,
}: {
	table: string[][];
	mapping: TaskImportMapping;
	options: TaskImportOptions;
	onMapping: (field: TaskImportField, column: number | null) => void;
	onOptions: (patch: Partial<TaskImportOptions>) => void;
	/** Task 55: the project's custom fields, each mapped to a column or none. */
	fields: ReadonlyArray<TaskField>;
	fieldMapping: FieldImportMapping;
	onFieldMapping: (fieldId: string, column: number | null) => void;
}) {
	const id = useId();
	const names = csvColumnNames(table, options.header);
	return (
		<fieldset className="flex flex-col gap-4">
			<legend className="mb-2 font-medium text-body">{m.taskline_import_columns()}</legend>
			<div className="flex items-center gap-2">
				<Checkbox
					id={`${id}-header`}
					checked={options.header}
					onCheckedChange={(checked) => onOptions({ header: checked === true })}
				/>
				<Label htmlFor={`${id}-header`} className="font-normal">
					{m.csv_header()}
				</Label>
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{TASK_IMPORT_FIELDS.map((field) => (
					<div key={field} className="flex flex-col gap-2">
						<Label htmlFor={`${id}-${field}`}>
							{FIELD_LABELS[field]()}
							{field === "title" ? null : (
								<span className="font-normal text-muted-foreground">{m.field_optional()}</span>
							)}
						</Label>
						<NativeSelect
							id={`${id}-${field}`}
							value={mapping[field] === null ? "" : String(mapping[field])}
							onChange={(event) => onMapping(field, event.target.value === "" ? null : Number(event.target.value))}
							data-testid={`import-map-${field}`}
						>
							<option value="">{field === "title" ? m.select_placeholder() : m.csv_not_in_file()}</option>
							{names.map((name, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: columns are positions; names may repeat.
								<option key={index} value={index}>
									{name}
								</option>
							))}
						</NativeSelect>
					</div>
				))}
				{fields.map((field) => (
					<div key={field.id} className="flex flex-col gap-2">
						<Label htmlFor={`${id}-cf-${field.id}`}>
							{field.name}
							<span className="font-normal text-muted-foreground">{m.field_optional()}</span>
						</Label>
						<NativeSelect
							id={`${id}-cf-${field.id}`}
							value={fieldMapping[field.id] == null ? "" : String(fieldMapping[field.id])}
							onChange={(event) =>
								onFieldMapping(field.id, event.target.value === "" ? null : Number(event.target.value))
							}
							data-testid="import-map-custom"
						>
							<option value="">{m.csv_not_in_file()}</option>
							{names.map((name, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: columns are positions; names may repeat.
								<option key={index} value={index}>
									{name}
								</option>
							))}
						</NativeSelect>
					</div>
				))}
				<div className="flex flex-col gap-2">
					<Label htmlFor={`${id}-format`}>{m.csv_date_format()}</Label>
					<NativeSelect
						id={`${id}-format`}
						value={options.dateFormat}
						onChange={(event) => {
							const value = CSV_DATE_FORMATS.find((format) => format === event.target.value);
							if (value) onOptions({ dateFormat: value });
						}}
					>
						{CSV_DATE_FORMATS.map((format) => (
							<option key={format} value={format}>
								{DATE_FORMAT_LABELS[format]()}
							</option>
						))}
					</NativeSelect>
				</div>
			</div>
		</fieldset>
	);
}

/** A problem's field: one of the task's, or a custom field by its name. */
const problemLabel = (problem: TaskImportProblem) =>
	problem.field === "custom" ? (problem.name ?? "") : FIELD_LABELS[problem.field]();

function Preview({
	rows,
	validCount,
	missing,
}: {
	rows: ReturnType<typeof previewTaskImport>;
	validCount: number;
	missing: ReturnType<typeof unmatchedNames>;
}) {
	const id = useId();
	const invalid = rows.filter((row) => !row.row);
	const notes = [
		missing.statuses.length > 0 ? m.taskline_import_unmatched_statuses({ names: missing.statuses.join(", ") }) : null,
		missing.assignees.length > 0
			? m.taskline_import_unmatched_assignees({ names: missing.assignees.join(", ") })
			: null,
		missing.labels.length > 0 ? m.taskline_import_unmatched_labels({ names: missing.labels.join(", ") }) : null,
	].flatMap((note) => (note === null ? [] : [note]));
	return (
		<div className="flex flex-col gap-4">
			<p className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-live="polite" data-testid="import-summary">
				<span className="inline-flex items-center gap-1.5 text-success">
					<CheckCircle2Icon className="size-4" aria-hidden />
					{m.taskline_import_valid({ count: formatNumber(validCount) })}
				</span>
				{invalid.length > 0 ? (
					<span className="inline-flex items-center gap-1.5 text-danger">
						<AlertCircleIcon className="size-4" aria-hidden />
						{m.taskline_import_invalid({ count: formatNumber(invalid.length) })}
					</span>
				) : null}
			</p>
			{notes.length > 0 ? (
				<Alert data-testid="import-unmatched">
					<TriangleAlertIcon aria-hidden />
					<AlertDescription className="flex flex-col gap-1">
						{notes.map((note) => (
							<span key={note} className="wrap-anywhere">
								{note}
							</span>
						))}
					</AlertDescription>
				</Alert>
			) : null}
			{/* A scrolling region is a tab stop, so keyboard users can scroll it too. */}
			<section
				aria-labelledby={id}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (axe scrollable-region-focusable).
				tabIndex={0}
				className="relative overflow-x-auto rounded-md border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<table className="w-full text-sm">
					<caption id={id} className="sr-only">
						{m.taskline_import_preview_caption({ count: formatNumber(Math.min(PREVIEW_ROWS, rows.length)) })}
					</caption>
					<thead className="border-b bg-surface-1 text-caption text-muted-foreground">
						<tr>
							<th scope="col" className="p-2 text-start font-medium">
								{m.taskline_import_line()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.taskline_field_title()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.taskline_field_status()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.taskline_field_assignee()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.taskline_field_priority()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.taskline_field_due()}
							</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{rows.slice(0, PREVIEW_ROWS).map((row) => (
							<tr key={row.line} className={cn(!row.row && "bg-danger-subtle")} data-testid="import-row">
								<td className="p-2 text-muted-foreground tabular-nums">{formatNumber(row.line)}</td>
								{row.row ? (
									<>
										<td className="max-w-56 truncate p-2">
											{row.row.type ? `${TYPE_LABELS[row.row.type]()} · ` : ""}
											{row.row.title}
										</td>
										<td className="p-2">{row.row.status}</td>
										<td className="p-2">{row.row.assignee}</td>
										<td className="whitespace-nowrap p-2">
											{PRIORITY_LABELS[row.row.priority as 0 | 1 | 2 | 3 | 4]()}
										</td>
										<td className="whitespace-nowrap p-2">{row.row.dueOn ?? ""}</td>
									</>
								) : (
									<td colSpan={5} className="p-2 text-danger">
										{row.problems.map((each) => `${problemLabel(each)}: ${each.message}`).join(" · ")}
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</section>
			{invalid.length > 0 ? (
				<div className="flex flex-col gap-2" data-testid="import-problems">
					<h3 className="font-medium text-body">{m.taskline_import_problems()}</h3>
					<ul className="flex flex-col gap-1 text-sm">
						{invalid.slice(0, PROBLEM_ROWS).map((row) => (
							<li key={row.line}>
								<span className="font-medium">{m.taskline_import_line_number({ line: formatNumber(row.line) })}</span>{" "}
								{row.problems.map((each) => `${problemLabel(each)}: ${each.message}`).join(" · ")}
							</li>
						))}
					</ul>
					{invalid.length > PROBLEM_ROWS ? (
						<p className="text-muted-foreground text-sm">
							{m.taskline_import_more_problems({ count: formatNumber(invalid.length - PROBLEM_ROWS) })}
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}
