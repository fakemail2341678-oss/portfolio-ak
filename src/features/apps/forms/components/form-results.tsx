import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, DownloadIcon, InboxIcon, ListChecksIcon, MessageSquareTextIcon, StarIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BarChart } from "@/components/charts";
import { DescriptionList } from "@/components/data-display/description-list";
import { StatCard } from "@/components/data-display/stat-card";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { errorMessage } from "@/components/errors/error-page";
import { Pagination } from "@/components/navigation/pagination";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { exportFormResponses } from "@/functions/apps/forms";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { type FormField, RATING_MAX } from "../fields";
import { FIELD_TYPE_INFO } from "../labels";
import { formResultsQueryOptions } from "../queries";
import { answerCsv, answerText } from "../results";
import type { FieldResult, FormResponse, FormResults } from "../types";

const route = getRouteApi("/_apps/apps/forms/$formId/results");

const one = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });

/**
 * /apps/forms/$formId/results (decision 0195): how many responded, a chart or the
 * numbers for each question (bars for choices, the average and the spread for
 * ratings, average and range for numbers, agreement for consent, the newest text
 * answers), every response in a table (one page at a time, `?page=`), and all of them
 * as a CSV file.
 */
export function FormResultsPage() {
	const { formId } = route.useParams();
	const { page } = route.useSearch();
	const { session } = route.useRouteContext();
	const userId = session.user.id;
	const { data } = useSuspenseQuery(formResultsQueryOptions(userId, formId, page));
	const [exporting, setExporting] = useState(false);
	const fields = data.form.fields;

	const exportCsv = async () => {
		setExporting(true);
		try {
			const rows = await exportFormResponses({ data: { id: formId } });
			downloadCsv(`${data.form.slug}-responses.csv`, toCsv(rows, csvColumns(fields)));
		} catch (error) {
			toast.error(m.common_toast_failed(), { description: errorMessage(error) });
		} finally {
			setExporting(false);
		}
	};

	return (
		<Page width="wide" data-testid="forms-results">
			<Button asChild variant="ghost" size="sm" className="-ms-2 w-fit">
				<Link to="/apps/forms/$formId" params={{ formId }}>
					<ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
					{m.forms_back_to_builder()}
				</Link>
			</Button>
			<PageHeader
				title={data.form.title}
				description={m.forms_results_description()}
				actions={
					<Button variant="outline" onClick={exportCsv} disabled={exporting || data.total === 0}>
						<DownloadIcon aria-hidden />
						{m.forms_export_csv()}
					</Button>
				}
			/>
			<section aria-labelledby="forms-stats" className="grid gap-4 sm:grid-cols-3">
				<h2 id="forms-stats" className="sr-only">
					{m.dashboard_stats_title()}
				</h2>
				<StatCard label={m.forms_results_total()} value={data.total} icon={InboxIcon} />
				<StatCard label={m.forms_results_questions()} value={fields.length} icon={ListChecksIcon} />
				<StatCard
					label={m.forms_results_completion()}
					value={completion(data)}
					format={(value) => formatNumber(value, { style: "percent" })}
					icon={MessageSquareTextIcon}
					hint={m.forms_results_completion_hint()}
				/>
			</section>
			{data.total === 0 ? (
				<EmptyState icon={InboxIcon} title={m.forms_results_empty_title()} description={m.forms_results_empty_body()} />
			) : (
				<>
					<section aria-labelledby="forms-questions" className="flex flex-col gap-4">
						<h2 id="forms-questions" className="text-heading">
							{m.forms_results_by_question()}
						</h2>
						<div className="grid gap-4 lg:grid-cols-2">
							{data.results.map((result, index) => {
								const field = fields[index];
								return field ? (
									<FieldResultCard key={result.fieldId} field={field} result={result} total={data.total} />
								) : null;
							})}
						</div>
					</section>
					<section aria-labelledby="forms-responses" className="flex min-w-0 flex-col gap-4">
						<h2 id="forms-responses" className="text-heading">
							{m.forms_results_responses()}
						</h2>
						<DataTable
							tableId={`forms-responses-${formId}`}
							rows={data.responses}
							columns={tableColumns(fields)}
							getRowId={(row) => row.id}
							getRowLabel={(row) => formatDateTime(row.submittedAt)}
							scrollRegion
							data-testid="forms-responses"
						/>
						<Pagination page={data.page} pageCount={data.pageCount} total={data.total} hideWhenSingle layout="split" />
					</section>
				</>
			)}
		</Page>
	);
}

/** The share of answers given out of every question in every response (0 with no responses). */
function completion(data: FormResults): number {
	if (data.total === 0 || data.results.length === 0) return 0;
	const answered = data.results.reduce((sum, result) => sum + result.answered, 0);
	return answered / (data.total * data.results.length);
}

const tableColumns = (fields: ReadonlyArray<FormField>): Array<DataTableColumn<FormResponse>> => [
	{
		id: "submitted",
		header: m.forms_results_submitted,
		cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.submittedAt)}</span>,
	},
	...fields.map(
		(field): DataTableColumn<FormResponse> => ({
			id: field.id,
			header: () => field.label,
			hideable: true,
			cell: (row) => (
				<span className="line-clamp-3 min-w-32 break-words">{answerText(field, row.answers[field.id])}</span>
			),
		}),
	),
];

const csvColumns = (fields: ReadonlyArray<FormField>) => [
	{ header: m.forms_results_submitted(), value: (row: FormResponse) => row.submittedAt },
	...fields.map((field) => ({
		header: field.label,
		value: (row: FormResponse) => answerCsv(field, row.answers[field.id]),
	})),
];

function FieldResultCard({ field, result, total }: { field: FormField; result: FieldResult; total: number }) {
	const info = FIELD_TYPE_INFO[field.type];
	return (
		<article className="flex min-w-0 flex-col gap-3 rounded-lg border p-4" data-testid="forms-field-result">
			<header className="flex flex-col gap-1">
				<h3 className="break-words font-medium text-body">{field.label}</h3>
				<p className="flex items-center gap-1.5 text-caption text-muted-foreground">
					<info.icon className="size-3.5" aria-hidden />
					{info.label()} ·{" "}
					{m.forms_results_answered({ count: formatNumber(result.answered), total: formatNumber(total) })}
				</p>
			</header>
			<ResultBody field={field} result={result} />
		</article>
	);
}

function ResultBody({ field, result }: { field: FormField; result: FieldResult }) {
	switch (result.kind) {
		case "choice": {
			const options = field.type === "single_select" || field.type === "multi_select" ? field.options : [];
			return (
				<BarChart
					label={m.forms_results_chart_label({ question: field.label })}
					data={result.counts.map((count) => ({
						option: options.find((option) => option.id === count.optionId)?.label ?? "",
						count: count.count,
					}))}
					index="option"
					series={[{ key: "count", label: m.forms_results_count() }]}
				/>
			);
		}
		case "rating":
			return (
				<div className="flex flex-col gap-3">
					<p className="flex items-center gap-2" data-testid="forms-rating-average">
						<StarIcon className="size-5 fill-warning text-warning" aria-hidden />
						<span className="font-semibold text-title" data-figures>
							{result.average === null ? "–" : one(result.average)}
						</span>
						<span className="text-muted-foreground text-sm">
							{m.forms_results_average_of({ max: formatNumber(RATING_MAX) })}
						</span>
					</p>
					<BarChart
						label={m.forms_results_chart_label({ question: field.label })}
						data={result.counts.map((count, index) => ({ score: formatNumber(index + 1), count }))}
						index="score"
						series={[{ key: "count", label: m.forms_results_count() }]}
					/>
				</div>
			);
		case "number":
			return (
				<DescriptionList
					items={[
						{ label: m.forms_results_average(), value: result.average === null ? "–" : one(result.average) },
						{ label: m.forms_results_lowest(), value: result.min === null ? "–" : formatNumber(result.min) },
						{ label: m.forms_results_highest(), value: result.max === null ? "–" : formatNumber(result.max) },
					]}
				/>
			);
		case "consent": {
			const share = result.answered === 0 ? 0 : result.agreed / result.answered;
			return (
				<div className="flex flex-col gap-2">
					<p className="text-sm">
						{m.forms_results_agreed({ count: formatNumber(result.agreed), total: formatNumber(result.answered) })}
					</p>
					<Progress value={share * 100} aria-label={m.forms_results_agreed_label()} />
				</div>
			);
		}
		case "text":
			return result.latest.length === 0 ? (
				<p className="text-muted-foreground text-sm">{m.forms_results_no_answers()}</p>
			) : (
				<div className="flex flex-col gap-2">
					<p className="text-caption text-muted-foreground">{m.forms_results_latest()}</p>
					<ul className="flex flex-col gap-2">
						{result.latest.map((answer, index) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: answers have no id of their own and never reorder.
								key={index}
								className="whitespace-pre-line break-words rounded-md bg-surface-1 px-3 py-2 text-sm"
							>
								{answerText(field, answer)}
							</li>
						))}
					</ul>
				</div>
			);
	}
}
