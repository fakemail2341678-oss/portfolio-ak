import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { ScrollRegion } from "@/components/data-display/scroll-region";
import { FilterBar } from "@/components/filters/filter-bar";
import { DateRangeFilter } from "@/components/filters/filters";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { formatDuration } from "../../time/duration";
import { timeOptionsQueryOptions, utilizationQueryOptions } from "../queries";
import { utilizationRange } from "../search";
import { TimeTabs } from "./time-list";

const route = getRouteApi("/_admin/admin/taskline/timesheets/utilization");

const dayText = (day: string) => formatDate(isoDateInstant(day), { dateStyle: "medium" });

/**
 * /admin/taskline/timesheets/utilization (Task 53, `taskline:time`): each active
 * member's time over some days against their capacity there (the weekly capacity
 * spread over the team's working days), and how much of it was billable.
 */
export function UtilizationPage() {
	const search = route.useSearch();
	const { data: options } = useSuspenseQuery(timeOptionsQueryOptions());
	const range = utilizationRange(search, options);
	const { data } = useSuspenseQuery(utilizationQueryOptions(range.from, range.to));
	return (
		<Page width="wide" data-testid="taskline-admin-utilization">
			<PageHeader
				title={m.taskline_admin_utilization_title()}
				description={m.taskline_admin_utilization_description({ from: dayText(data.from), to: dayText(data.to) })}
				tabs={<TimeTabs />}
			/>
			<FilterBar values={search}>
				<DateRangeFilter label={m.taskline_time_field_day()} names={["from", "to"]} value={[search.from, search.to]} />
			</FilterBar>
			{data.rows.length === 0 ? (
				<EmptyState icon={UsersIcon} description={m.taskline_admin_utilization_empty()} />
			) : (
				<ScrollRegion className="rounded-lg border">
					<table className="w-full min-w-[40rem] border-collapse text-body" data-testid="utilization-table">
						<caption className="sr-only">{m.taskline_admin_utilization_title()}</caption>
						<thead>
							<tr className="border-b bg-surface-1 text-caption text-muted-foreground">
								<th scope="col" className="px-3 py-2 text-start font-medium">
									{m.taskline_time_member()}
								</th>
								<th scope="col" className="px-3 py-2 text-end font-medium">
									{m.taskline_admin_capacity()}
								</th>
								<th scope="col" className="px-3 py-2 text-end font-medium">
									{m.taskline_time_logged_label()}
								</th>
								<th scope="col" className="px-3 py-2 text-end font-medium">
									{m.taskline_time_billable_label()}
								</th>
								<th scope="col" className="px-3 py-2 text-start font-medium">
									{m.taskline_admin_utilization()}
								</th>
							</tr>
						</thead>
						<tbody>
							{data.rows.map((row) => {
								const share = row.capacityMinutes === 0 ? null : row.loggedMinutes / row.capacityMinutes;
								return (
									<tr key={row.memberId} className="border-b last:border-b-0" data-testid="utilization-row">
										<th scope="row" className="px-3 py-2 text-start font-normal">
											{row.name}
										</th>
										<td className="px-3 py-2 text-end tabular-nums">{formatDuration(row.capacityMinutes)}</td>
										<td className="px-3 py-2 text-end tabular-nums">{formatDuration(row.loggedMinutes)}</td>
										<td className="px-3 py-2 text-end tabular-nums">{formatDuration(row.billableMinutes)}</td>
										<td className="px-3 py-2">
											{share === null ? (
												<span className="text-muted-foreground">–</span>
											) : (
												<span className="flex min-w-36 items-center gap-2">
													<span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
														<span
															className={cn("block h-full", share > 1 ? "bg-warning" : "bg-primary")}
															style={{ width: `${Math.min(100, share * 100)}%` }}
														/>
													</span>
													<span className="w-12 text-end text-caption tabular-nums">
														{formatNumber(share, { style: "percent", maximumFractionDigits: 0 })}
													</span>
												</span>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</ScrollRegion>
			)}
		</Page>
	);
}
