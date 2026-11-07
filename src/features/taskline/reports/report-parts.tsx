import { DownloadIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { type CsvColumn, downloadCsv, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { REPORT_RANGES, type ReportRange } from "../types";

/** What a project's and the admin's reports share (Task 57). */

export const RANGE_LABELS: Record<ReportRange, () => string> = {
	"4w": m.taskline_report_range_4w,
	"12w": m.taskline_report_range_12w,
	"26w": m.taskline_report_range_26w,
};

/** The weeks a report covers: links, so the choice is in the URL and works without JavaScript. */
export function ReportRangeNav({
	current,
	link,
}: {
	current: ReportRange;
	/** One range's link, given its class and aria-current. */
	link: (range: ReportRange, props: { className: string; "aria-current"?: "true"; "data-testid": string }) => ReactNode;
}) {
	return (
		<nav aria-label={m.taskline_report_range()} className="flex w-fit rounded-md border p-0.5">
			{REPORT_RANGES.map((range) => (
				<span key={range} className="contents">
					{link(range, {
						className: cn(
							"rounded-sm px-3 py-1 text-caption outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
							range === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
						),
						"aria-current": range === current ? "true" : undefined,
						"data-testid": `report-range-${range}`,
					})}
				</span>
			))}
		</nav>
	);
}

/** One report: its heading, a line about it, what it shows, and its numbers as a CSV file. */
export function ReportCard<Row>({
	id,
	title,
	summary,
	filename,
	rows,
	columns,
	children,
	className,
}: {
	id: string;
	title: string;
	summary?: ReactNode;
	/** The file's name, without the extension. */
	filename: string;
	rows: ReadonlyArray<Row>;
	columns: ReadonlyArray<CsvColumn<Row>>;
	children: ReactNode;
	className?: string;
}) {
	const headingId = `report-${id}`;
	return (
		<section
			aria-labelledby={headingId}
			className={cn("flex min-w-0 flex-col gap-3 rounded-lg border p-4", className)}
			data-testid={headingId}
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="flex min-w-0 flex-col gap-1">
					<h2 id={headingId} className="text-heading">
						{title}
					</h2>
					{summary ? <p className="text-caption text-muted-foreground">{summary}</p> : null}
				</div>
				<Button
					variant="outline"
					size="sm"
					disabled={rows.length === 0}
					aria-label={m.taskline_report_csv({ report: title })}
					onClick={() => downloadCsv(`${filename}.csv`, toCsv(rows, columns))}
					data-testid={`report-csv-${id}`}
				>
					<DownloadIcon aria-hidden />
					{m.table_export_csv()}
				</Button>
			</div>
			{children}
		</section>
	);
}
