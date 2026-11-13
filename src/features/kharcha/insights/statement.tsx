import { useSuspenseQuery } from "@tanstack/react-query";
import { PrinterIcon } from "lucide-react";
import { ScrollRegion } from "@/components/data-display/scroll-region";
import { FilterBar } from "@/components/filters/filter-bar";
import { DateRangeFilter } from "@/components/filters/filters";
import { Button } from "@/components/ui/button";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { KHARCHA_NAME } from "../brand";
import { KharchaEmpty } from "../kit/empty";
import { Money } from "../kit/money";
import { kharchaStatementQueryOptions } from "../queries";
import { type InsightsSearch, STATEMENT_LINES_MAX, statementOf } from "../search";
import { useKharchaUserId } from "../shell/actions";
import { categoryLabel } from "./overview";

const day = (value: string) => formatDate(isoDateInstant(value), { dateStyle: "medium", timeZone: "UTC" });

/**
 * Insights → Statement (Task 94): any days (this month until chosen), per currency: what
 * the caller spent, the refunds, the two together, by their own categories, and every
 * expense with its amount and their share. "Print" is the browser's, so "Save as PDF" is
 * too: the print stylesheet leaves out the shell and the controls, and keeps rows whole.
 */
export function StatementTab({ search }: { search: InsightsSearch }) {
	const userId = useKharchaUserId();
	const { data } = useSuspenseQuery(kharchaStatementQueryOptions(userId, statementOf(search)));
	const range = m.kharcha_statement_range({ from: day(data.from), to: day(data.to) });
	return (
		<div className="flex flex-col gap-4" data-testid="kharcha-statement">
			<div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
				<FilterBar values={search} label={m.kharcha_statement_days()}>
					<DateRangeFilter label={m.kharcha_statement_days()} names={["from", "to"]} value={[search.from, search.to]} />
				</FilterBar>
				<Button variant="outline" onClick={() => window.print()} data-testid="kharcha-statement-print">
					<PrinterIcon aria-hidden />
					{m.kharcha_statement_print()}
				</Button>
			</div>
			<header className="flex flex-col gap-0.5">
				<p className="hidden text-kh-muted text-sm print:block">{KHARCHA_NAME}</p>
				<h2 className="kh-display text-kh-head">{m.kharcha_insights_statement()}</h2>
				<p className="text-kh-muted text-sm" data-testid="kharcha-statement-range">
					{range}
				</p>
			</header>
			{data.currencies.length === 0 ? (
				<KharchaEmpty kind="insights" className="rounded-lg border border-kh-hair bg-kh-page" />
			) : (
				data.currencies.map((statement) => (
					<section
						key={statement.currency}
						aria-label={statement.currency}
						className="flex flex-col gap-4 rounded-lg border border-kh-hair bg-kh-page p-4 print:rounded-none print:border-0 print:p-0"
						data-testid="kharcha-statement-currency"
					>
						<h3 className="font-medium text-kh-ink">{statement.currency}</h3>
						<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							{[
								{ label: m.kharcha_statement_spent(), value: statement.spent },
								{ label: m.kharcha_statement_refunds(), value: statement.refunds },
								{ label: m.kharcha_statement_net(), value: statement.net },
							].map((item) => (
								<div key={item.label} className="flex flex-col gap-0.5">
									<dt className="text-caption text-kh-muted">{item.label}</dt>
									<dd>
										<Money amountMinor={item.value} currency={statement.currency} size="lg" />
									</dd>
								</div>
							))}
							<div className="flex flex-col gap-0.5">
								<dt className="text-caption text-kh-muted">{m.kharcha_statement_count()}</dt>
								<dd className="kh-display kh-figures text-kh-head">{formatNumber(statement.count)}</dd>
							</div>
						</dl>
						<ScrollRegion label={m.kharcha_statement_by_category({ currency: statement.currency })}>
							<table className="w-full text-sm">
								<caption className="sr-only">
									{m.kharcha_statement_by_category({ currency: statement.currency })}
								</caption>
								<thead className="text-left text-caption text-kh-muted">
									<tr>
										<th scope="col" className="py-1.5 font-normal">
											{m.kharcha_field_category()}
										</th>
										<th scope="col" className="py-1.5 text-right font-normal">
											{m.kharcha_statement_your_share()}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-kh-rule">
									{statement.byCategory.map((row) => (
										<tr key={row.key || "none"}>
											<td className="py-1.5">{categoryLabel(row)}</td>
											<td className="py-1.5 text-right">
												<Money amountMinor={row.amountMinor} currency={statement.currency} size="sm" />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</ScrollRegion>
						<ScrollRegion label={m.kharcha_statement_lines({ currency: statement.currency })}>
							<table className="w-full min-w-[36rem] text-sm" data-testid="kharcha-statement-lines">
								<caption className="sr-only">{m.kharcha_statement_lines({ currency: statement.currency })}</caption>
								<thead className="text-left text-caption text-kh-muted">
									<tr>
										<th scope="col" className="py-1.5 pr-3 font-normal">
											{m.kharcha_field_date()}
										</th>
										<th scope="col" className="py-1.5 pr-3 font-normal">
											{m.kharcha_field_title()}
										</th>
										<th scope="col" className="py-1.5 pr-3 font-normal">
											{m.kharcha_field_category()}
										</th>
										<th scope="col" className="py-1.5 pr-3 text-right font-normal">
											{m.kharcha_field_amount()}
										</th>
										<th scope="col" className="py-1.5 text-right font-normal">
											{m.kharcha_statement_your_share()}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-kh-rule">
									{statement.lines.map((line) => (
										<tr key={line.id} className="print:break-inside-avoid">
											<td className="whitespace-nowrap py-1.5 pr-3 text-kh-muted">{day(line.spentOn)}</td>
											<td className="py-1.5 pr-3">
												<span className="block">
													{line.title || line.merchant || m.kharcha_untitled()}
													{line.kind === "refund" ? (
														<span className="text-kh-muted">{` · ${m.kharcha_statement_refund()}`}</span>
													) : null}
												</span>
												{line.group ? <span className="block text-caption text-kh-muted">{line.group}</span> : null}
											</td>
											<td className="py-1.5 pr-3">{line.category?.name ?? m.kharcha_category_none()}</td>
											<td className="py-1.5 pr-3 text-right">
												<Money amountMinor={line.amountMinor} currency={statement.currency} size="sm" tone="muted" />
											</td>
											<td className="py-1.5 text-right">
												<Money
													amountMinor={line.kind === "refund" ? -line.myShareMinor : line.myShareMinor}
													currency={statement.currency}
													size="sm"
												/>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</ScrollRegion>
					</section>
				))
			)}
			{data.truncated ? (
				<p className="text-caption text-kh-muted">
					{m.kharcha_statement_truncated({ count: formatNumber(STATEMENT_LINES_MAX) })}
				</p>
			) : null}
		</div>
	);
}
