import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircleIcon, ArrowLeftIcon, CheckCircle2Icon, FileUpIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { type CsvSource, CsvSourcePicker, csvColumnNames } from "@/components/forms/csv-source";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { CSV_DATE_FORMATS, type CsvDateFormat } from "@/lib/csv";
import { formatMoney } from "@/lib/i18n/currency";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { kharchaLinks } from "../links";
import { kharchaMeQueryOptions, kharchaMutations } from "../queries";
import { useKharchaUserId } from "../shell/actions";
import {
	guessMapping,
	IMPORT_FIELDS,
	type ImportField,
	type ImportMapping,
	type ImportOptions,
	type PreviewRow,
	previewImport,
	tableProblem,
} from "./csv";

/** Rows shown in the preview table (every problem is listed below it). */
const PREVIEW_ROWS = 20;
/** Problems listed before "and N more". */
const PROBLEM_ROWS = 50;

const FIELD_LABELS: Record<ImportField, () => string> = {
	date: () => m.kharcha_field_date(),
	amount: () => m.kharcha_field_amount(),
	currency: () => m.kharcha_field_currency(),
	type: () => m.kharcha_field_kind(),
	title: () => m.kharcha_field_title(),
	merchant: () => m.kharcha_field_merchant(),
	category: () => m.kharcha_field_category(),
	tags: () => m.kharcha_field_tags(),
	method: () => m.kharcha_field_method(),
	notes: () => m.kharcha_field_notes(),
};

const DATE_FORMAT_LABELS: Record<CsvDateFormat, () => string> = {
	ymd: () => m.csv_format_ymd(),
	dmy: () => m.csv_format_dmy(),
	mdy: () => m.csv_format_mdy(),
};

/**
 * /app/kharcha/import (Task 93; Expenses' import, 0192, moved and extended): a CSV file
 * (or pasted text) into personal expenses in three steps on one page: the file, which
 * column is which, and a preview where every row is checked by the schema the server uses.
 * Only valid rows are sent, once: a new idempotency key comes with each preview, so a
 * double click or a retry can't import twice. Spend's own CSV maps itself, in any language.
 */
export function KharchaImportPage() {
	const userId = useKharchaUserId();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { data: me } = useSuspenseQuery(kharchaMeQueryOptions(userId));
	const save = useMutation(kharchaMutations.importSpend(queryClient, userId));
	const [source, setSource] = useState<CsvSource | null>(null);
	const [mapping, setMapping] = useState<ImportMapping | null>(null);
	const [options, setOptions] = useState<ImportOptions>({
		header: true,
		dateFormat: "ymd",
		currency: me.currencies.includes(me.profile.homeCurrency) ? me.profile.homeCurrency : (me.currencies[0] ?? "NPR"),
	});
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
	const rows = source && ready && !problem ? previewImport(source.table, mapping, options, me.currencies) : [];
	const valid = rows.flatMap((row) => (row.row ? [row.row] : []));
	const invalid = rows.filter((row) => !row.row);

	const submit = () =>
		save.mutate(
			{ key, rows: valid },
			{
				onSuccess: async (result) => {
					toast.success(
						m.kharcha_import_done({
							count: formatNumber(result.inserted),
							lists: formatNumber(result.categories + result.tags + result.methods),
						}),
					);
					await navigate(kharchaLinks.spend());
				},
				onError: (failure) => toast.error(errorMessage(failure)),
			},
		);

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col" data-testid="kharcha-import">
			<header className="flex flex-col gap-1 border-kh-hair border-b bg-kh-page px-4 py-4 sm:px-8 md:py-5">
				<Button asChild variant="ghost" size="sm" className="-ms-2 w-fit">
					<Link {...kharchaLinks.spend()}>
						<ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
						{m.kharcha_nav_spend()}
					</Link>
				</Button>
				<h1 className="kh-display text-kh-title">{m.kharcha_import_title()}</h1>
				<p className="text-kh-muted text-sm">{m.kharcha_import_description()}</p>
			</header>
			<div className="flex max-w-4xl flex-col gap-4 px-4 py-4 sm:px-8 sm:py-6">
				<Step number={1} title={m.kharcha_import_step_file()}>
					<CsvSourcePicker
						hint={m.kharcha_import_file_hint()}
						placeholder={"date,amount,merchant,category,tags\n2026-11-01,450,Himalayan Java,Coffee,work"}
						onLoad={load}
					/>
				</Step>
				{source && mapping ? (
					<Step number={2} title={m.kharcha_import_step_columns()}>
						<ColumnsStep
							table={source.table}
							mapping={mapping}
							options={options}
							currencies={me.currencies}
							onMapping={changeMapping}
							onOptions={changeOptions}
						/>
					</Step>
				) : null}
				{source && mapping ? (
					<Step number={3} title={m.kharcha_import_step_preview()}>
						{problem ? (
							<Alert variant="destructive">
								<AlertCircleIcon aria-hidden />
								<AlertDescription>{problem}</AlertDescription>
							</Alert>
						) : !ready ? (
							<p className="text-kh-muted text-sm">{m.kharcha_import_map_required()}</p>
						) : (
							<Preview rows={rows} invalid={invalid} validCount={valid.length} />
						)}
						<div className="flex flex-wrap items-center gap-3">
							<Button
								onClick={submit}
								disabled={valid.length === 0 || save.isPending}
								data-testid="kharcha-import-submit"
							>
								<FileUpIcon aria-hidden />
								{m.kharcha_import_submit({ count: formatNumber(valid.length) })}
							</Button>
							{invalid.length > 0 && valid.length > 0 ? (
								<span className="text-kh-muted text-sm">
									{m.kharcha_import_skipping({ count: formatNumber(invalid.length) })}
								</span>
							) : null}
						</div>
					</Step>
				) : null}
			</div>
		</main>
	);
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
	const id = useId();
	return (
		<section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg border border-kh-hair bg-kh-page p-4">
			<h2 id={id} className="flex items-center gap-2 font-medium">
				<span
					aria-hidden
					className="kh-figures flex size-6 items-center justify-center rounded-full bg-kh-ground text-caption"
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
	currencies,
	onMapping,
	onOptions,
}: {
	table: string[][];
	mapping: ImportMapping;
	options: ImportOptions;
	currencies: ReadonlyArray<string>;
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
								{required ? null : <span className="font-normal text-kh-muted">{m.field_optional()}</span>}
							</Label>
							<NativeSelect
								id={`${id}-${field}`}
								value={mapping[field] === null ? "" : String(mapping[field])}
								onChange={(event) => onMapping(field, event.target.value === "" ? null : Number(event.target.value))}
								data-testid={`kharcha-import-map-${field}`}
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
					<Label htmlFor={`${id}-currency`}>{m.kharcha_import_default_currency()}</Label>
					<NativeSelect
						id={`${id}-currency`}
						value={options.currency}
						onChange={(event) => onOptions({ currency: event.target.value })}
					>
						{currencies.map((code) => (
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

const problemsOf = (row: PreviewRow) =>
	row.problems.map((each) => `${FIELD_LABELS[each.field]()}: ${each.message}`).join(" · ");

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
			<p className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-live="polite" data-testid="kharcha-import-summary">
				<span className="inline-flex items-center gap-1.5 text-kh-owed">
					<CheckCircle2Icon className="size-4" aria-hidden />
					{m.kharcha_import_valid({ count: formatNumber(validCount) })}
				</span>
				{invalid.length > 0 ? (
					<span className="inline-flex items-center gap-1.5 text-kh-owe">
						<AlertCircleIcon className="size-4" aria-hidden />
						{m.kharcha_import_invalid({ count: formatNumber(invalid.length) })}
					</span>
				) : null}
			</p>
			<section
				aria-labelledby={id}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (axe scrollable-region-focusable).
				tabIndex={0}
				className="relative overflow-x-auto rounded-md border border-kh-hair outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<table className="w-full text-sm">
					<caption id={id} className="sr-only">
						{m.kharcha_import_preview_caption({ count: formatNumber(Math.min(PREVIEW_ROWS, rows.length)) })}
					</caption>
					<thead className="border-kh-hair border-b bg-kh-ground text-caption text-kh-muted">
						<tr>
							<th scope="col" className="p-2 text-start font-medium">
								{m.kharcha_import_line()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.kharcha_field_date()}
							</th>
							<th scope="col" className="p-2 text-end font-medium">
								{m.kharcha_field_amount()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.kharcha_field_merchant()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.kharcha_field_category()}
							</th>
							<th scope="col" className="p-2 text-start font-medium">
								{m.kharcha_field_tags()}
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-kh-hair">
						{rows.slice(0, PREVIEW_ROWS).map((row) => (
							<tr key={row.line} className={cn(!row.row && "bg-kh-owe-bg")} data-testid="kharcha-import-row">
								<td className="kh-figures p-2 text-kh-muted">{formatNumber(row.line)}</td>
								{row.row ? (
									<>
										<td className="kh-figures whitespace-nowrap p-2">{row.row.spentOn}</td>
										<td className="kh-figures whitespace-nowrap p-2 text-end">
											{row.row.kind === "refund" ? "−" : ""}
											{formatMoney(row.row.amountMinor, row.row.currency)}
										</td>
										<td className="max-w-48 truncate p-2">{row.row.merchant || row.row.title}</td>
										<td className="p-2">{row.row.category || m.kharcha_category_none()}</td>
										<td className="p-2">{row.row.tags.join(", ")}</td>
									</>
								) : (
									<td colSpan={5} className="p-2 text-kh-owe">
										{problemsOf(row)}
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</section>
			{invalid.length > 0 ? (
				<div className="flex flex-col gap-2" data-testid="kharcha-import-problems">
					<h3 className="font-medium">{m.kharcha_import_problems_title()}</h3>
					<ul className="flex flex-col gap-1 text-sm">
						{invalid.slice(0, PROBLEM_ROWS).map((row) => (
							<li key={row.line}>
								<span className="font-medium">{m.kharcha_import_line_number({ line: formatNumber(row.line) })}</span>{" "}
								{problemsOf(row)}
							</li>
						))}
					</ul>
					{invalid.length > PROBLEM_ROWS ? (
						<p className="text-kh-muted text-sm">
							{m.kharcha_import_more_problems({ count: formatNumber(invalid.length - PROBLEM_ROWS) })}
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}
