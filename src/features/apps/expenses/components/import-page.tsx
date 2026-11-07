import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircleIcon, ArrowLeftIcon, CheckCircle2Icon, FileUpIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { type CsvSource, CsvSourcePicker, csvColumnNames } from "@/components/forms/csv-source";
import { Page, PageHeader } from "@/components/page/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { CSV_DATE_FORMATS, type CsvDateFormat } from "@/lib/csv";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { formatMoney } from "../format";
import {
	guessMapping,
	IMPORT_FIELDS,
	type ImportField,
	type ImportMapping,
	type ImportOptions,
	type PreviewRow,
	previewImport,
	tableProblem,
} from "../import";
import { expenseMutations } from "../queries";
import { EXPENSE_CURRENCIES, isExpenseCurrency } from "../types";

const route = getRouteApi("/_apps/apps/expenses/import");

/** Rows shown in the preview table (every problem is listed below it). */
const PREVIEW_ROWS = 20;
/** Problems listed before "and N more". */
const PROBLEM_ROWS = 50;

const FIELD_LABELS: Record<ImportField, () => string> = {
	date: m.expenses_field_date,
	amount: m.expenses_field_amount,
	category: m.expenses_field_category,
	note: m.expenses_field_note,
	currency: m.expenses_field_currency,
};

const DATE_FORMAT_LABELS: Record<CsvDateFormat, () => string> = {
	ymd: m.csv_format_ymd,
	dmy: m.csv_format_dmy,
	mdy: m.csv_format_mdy,
};

/**
 * /apps/expenses/import (decision 0192): a CSV file (or pasted text) into expenses in
 * three steps on one page: the file, which column is which, and a preview where every
 * row is checked by the same schema the server uses. Only valid rows are sent, once:
 * the import's idempotency key is made with each preview, so a double click or a
 * retry can't import twice.
 */
export function ExpensesImportPage() {
	const { session } = route.useRouteContext();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const save = useMutation(expenseMutations.import(queryClient, session.user.id));
	const [source, setSource] = useState<CsvSource | null>(null);
	const [mapping, setMapping] = useState<ImportMapping | null>(null);
	const [options, setOptions] = useState<ImportOptions>({ header: true, dateFormat: "ymd", currency: "NPR" });
	// One key per preview: anything that changes the rows makes a new one (an import of other rows).
	const [key, setKey] = useState(() => crypto.randomUUID());

	const load = (loaded: CsvSource | null) => {
		setSource(loaded);
		setMapping(loaded ? guessMapping(loaded.table[0] ?? []) : null);
		setKey(crypto.randomUUID());
	};

	const changeMapping = (field: ImportField, column: number | null) => {
		setMapping((current) => (current ? { ...current, [field]: column } : current));
		setKey(crypto.randomUUID());
	};
	const changeOptions = (patch: Partial<ImportOptions>) => {
		setOptions((current) => ({ ...current, ...patch }));
		setKey(crypto.randomUUID());
	};

	const problem = source ? tableProblem(source.table, options) : null;
	const ready = mapping && mapping.date !== null && mapping.amount !== null;
	const rows = source && ready && !problem ? previewImport(source.table, mapping, options) : [];
	const valid = rows.flatMap((row) => (row.row ? [row.row] : []));
	const invalid = rows.filter((row) => !row.row);

	const submit = () =>
		save.mutate(
			{ key, rows: valid },
			{
				onSuccess: async (result) => {
					toast.success(
						m.expenses_import_done({
							count: formatNumber(result.inserted),
							categories: formatNumber(result.categoriesCreated),
						}),
					);
					await navigate({ to: "/apps/expenses" });
				},
				onError: (failure) => toast.error(m.common_toast_failed(), { description: errorMessage(failure) }),
			},
		);

	return (
		<Page width="default" data-testid="expenses-import">
			<Button asChild variant="ghost" size="sm" className="-ms-2 w-fit">
				<Link to="/apps/expenses">
					<ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
					{m.expenses_back()}
				</Link>
			</Button>
			<PageHeader title={m.expenses_import_title()} description={m.expenses_import_description()} />
			<Step number={1} title={m.expenses_import_step_file()}>
				<CsvSourcePicker
					hint={m.expenses_import_file_hint()}
					placeholder={"date,amount,category\n2026-10-01,450,Food"}
					onLoad={load}
				/>
			</Step>
			{source && mapping ? (
				<Step number={2} title={m.expenses_import_step_columns()}>
					<ColumnsStep
						table={source.table}
						mapping={mapping}
						options={options}
						onMapping={changeMapping}
						onOptions={changeOptions}
					/>
				</Step>
			) : null}
			{source && mapping ? (
				<Step number={3} title={m.expenses_import_step_preview()}>
					{problem ? (
						<Alert variant="destructive">
							<AlertCircleIcon aria-hidden />
							<AlertDescription>{problem}</AlertDescription>
						</Alert>
					) : !ready ? (
						<p className="text-muted-foreground text-sm">{m.expenses_import_map_required()}</p>
					) : (
						<Preview rows={rows} invalid={invalid} validCount={valid.length} />
					)}
					<div className="flex flex-wrap items-center gap-3">
						<Button onClick={submit} disabled={valid.length === 0 || save.isPending} data-testid="import-submit">
							<FileUpIcon aria-hidden />
							{m.expenses_import_submit({ count: formatNumber(valid.length) })}
						</Button>
						{invalid.length > 0 && valid.length > 0 ? (
							<span className="text-muted-foreground text-sm">
								{m.expenses_import_skipping({ count: formatNumber(invalid.length) })}
							</span>
						) : null}
					</div>
				</Step>
			) : null}
		</Page>
	);
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
	const id = useId();
	return (
		<section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg border p-4">
			<h2 id={id} className="flex items-center gap-2 text-heading">
				<span
					aria-hidden
					className="flex size-6 items-center justify-center rounded-full bg-surface-2 font-medium text-caption tabular-nums"
				>
					{formatNumber(number)}
				</span>
				{title}
			</h2>
			{children}
		</section>
	);
}

function ColumnsStep({
	table,
	mapping,
	options,
	onMapping,
	onOptions,
}: {
	table: string[][];
	mapping: ImportMapping;
	options: ImportOptions;
	onMapping: (field: ImportField, column: number | null) => void;
	onOptions: (patch: Partial<ImportOptions>) => void;
}) {
	const id = useId();
	const names = csvColumnNames(table, options.header);
	return (
		<div className="flex flex-col gap-4">
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
				{IMPORT_FIELDS.map((field) => {
					const required = field === "date" || field === "amount";
					return (
						<div key={field} className="flex flex-col gap-2">
							<Label htmlFor={`${id}-${field}`}>
								{FIELD_LABELS[field]()}
								{required ? null : <span className="font-normal text-muted-foreground">{m.field_optional()}</span>}
							</Label>
							<NativeSelect
								id={`${id}-${field}`}
								value={mapping[field] === null ? "" : String(mapping[field])}
								onChange={(event) => onMapping(field, event.target.value === "" ? null : Number(event.target.value))}
								data-testid={`import-map-${field}`}
							>
								<option value="">{required ? m.select_placeholder() : m.csv_not_in_file()}</option>
								{names.map((name, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: columns are positions; names may repeat.
									<option key={index} value={index}>
										{name}
									</option>
								))}
							</NativeSelect>
						</div>
					);
				})}
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
				<div className="flex flex-col gap-2">
					<Label htmlFor={`${id}-currency`}>{m.expenses_import_default_currency()}</Label>
					<NativeSelect
						id={`${id}-currency`}
						value={options.currency}
						onChange={(event) => {
							const value: string = event.target.value;
							if (isExpenseCurrency(value)) onOptions({ currency: value });
						}}
					>
						{EXPENSE_CURRENCIES.map((code) => (
							<option key={code} value={code}>
								{code}
							</option>
						))}
					</NativeSelect>
				</div>
			</div>
		</div>
	);
}

function Preview({
	rows,
	invalid,
	validCount,
}: {
	rows: ReadonlyArray<PreviewRow>;
	invalid: ReadonlyArray<PreviewRow>;
	validCount: number;
}) {
	const id = useId();
	return (
		<div className="flex flex-col gap-4">
			<p className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-live="polite" data-testid="import-summary">
				<span className="inline-flex items-center gap-1.5 text-success">
					<CheckCircle2Icon className="size-4" aria-hidden />
					{m.expenses_import_valid({ count: formatNumber(validCount) })}
				</span>
				{invalid.length > 0 ? (
					<span className="inline-flex items-center gap-1.5 text-danger">
						<AlertCircleIcon className="size-4" aria-hidden />
						{m.expenses_import_invalid({ count: formatNumber(invalid.length) })}
					</span>
				) : null}
			</p>
			{/* A scrolling region is a tab stop, so keyboard users can scroll it too. */}
			<section
				aria-labelledby={id}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (axe scrollable-region-focusable).
				tabIndex={0}
				className="relative overflow-x-auto rounded-md border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<table className="w-full text-sm">
					<caption id={id} className="sr-only">
						{m.expenses_import_preview_caption({ count: formatNumber(Math.min(PREVIEW_ROWS, rows.length)) })}
					</caption>
					<thead className="border-b bg-surface-1 text-start text-caption text-muted-foreground">
						<tr>
							<th scope="col" className="p-2 text-start font-medium">
								{m.expenses_import_line()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.expenses_field_date()}
							</th>
							<th scope="col" className="p-2 text-end font-medium">
								{m.expenses_field_amount()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.expenses_field_category()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.expenses_field_note()}
							</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{rows.slice(0, PREVIEW_ROWS).map((row) => (
							<tr key={row.line} className={cn(!row.row && "bg-danger-subtle")} data-testid="import-row">
								<td className="p-2 text-muted-foreground tabular-nums">{formatNumber(row.line)}</td>
								{row.row ? (
									<>
										<td className="whitespace-nowrap p-2">{row.row.occurredOn}</td>
										<td className="whitespace-nowrap p-2 text-end tabular-nums">
											{formatMoney(row.row.amountMinor, row.row.currency)}
										</td>
										<td className="p-2">{row.row.category || m.expenses_uncategorized()}</td>
										<td className="max-w-48 truncate p-2">{row.row.note}</td>
									</>
								) : (
									<td colSpan={4} className="p-2 text-danger">
										{row.problems.map((each) => `${FIELD_LABELS[each.field]()}: ${each.message}`).join(" · ")}
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</section>
			{invalid.length > 0 ? (
				<div className="flex flex-col gap-2" data-testid="import-problems">
					<h3 className="font-medium text-body">{m.expenses_import_problems_title()}</h3>
					<ul className="flex flex-col gap-1 text-sm">
						{invalid.slice(0, PROBLEM_ROWS).map((row) => (
							<li key={row.line}>
								<span className="font-medium">{m.expenses_import_line_number({ line: formatNumber(row.line) })}</span>{" "}
								{row.problems.map((each) => `${FIELD_LABELS[each.field]()}: ${each.message}`).join(" · ")}
							</li>
						))}
					</ul>
					{invalid.length > PROBLEM_ROWS ? (
						<p className="text-muted-foreground text-sm">
							{m.expenses_import_more_problems({ count: formatNumber(invalid.length - PROBLEM_ROWS) })}
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}
