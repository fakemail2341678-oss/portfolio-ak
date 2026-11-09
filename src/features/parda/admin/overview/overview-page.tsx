import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, linkOptions } from "@tanstack/react-router";
import { ActivityIcon, ClockIcon, FlagIcon, PlayIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";
import { BarChart } from "@/components/charts";
import { StatCard } from "@/components/data-display/stat-card";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { SegmentNav } from "@/components/navigation/segment-nav";
import { Page, PageHeader } from "@/components/page/page";
import { formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { PARDA_NAME } from "../../brand";
import { pardaOverviewQueryOptions } from "../queries";
import type { AdminOverview } from "../schema";
import { PARDA_OVERVIEW_RANGES, type PardaOverviewRange } from "../search";
import { TitleCell, titleText } from "../title-cell";

const route = getRouteApi("/_admin/admin/parda/");

const RANGE_LABELS: Readonly<Record<PardaOverviewRange, () => string>> = {
	today: m.pd_admin_range_today,
	"7d": m.pd_admin_range_week,
	"30d": m.pd_admin_range_month,
};

const percent = (value: number) => formatNumber(value, { style: "percent", maximumFractionDigits: 1 });
/** Hours, one decimal under ten: watch time is read at a glance. */
const hours = (seconds: number) => {
	const value = seconds / 3_600;
	return m.pd_admin_hours({ hours: formatNumber(value, { maximumFractionDigits: value < 10 ? 1 : 0 }) });
};
const NUMBER_CELL = "text-end tabular-nums";

type TopTitle = AdminOverview["topTitles"][number];

const titleColumns: ReadonlyArray<DataTableColumn<TopTitle>> = [
	{
		id: "title",
		header: m.pd_admin_col_title,
		cellClassName: "max-w-72",
		cell: (row) => <TitleCell row={row} />,
	},
	{
		id: "plays",
		header: m.pd_admin_col_plays_range,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatNumber(row.plays),
	},
	{
		id: "watched",
		header: m.pd_admin_col_watched,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => hours(row.watchedS),
	},
];

type ServerRow = AdminOverview["servers"][number];

/** Few rows and small counts: a table says how many plays each rate rests on, which a bar chart wouldn't. */
const serverColumns: ReadonlyArray<DataTableColumn<ServerRow>> = [
	{ id: "server", header: m.pd_admin_col_name, cell: (row) => localizedValue(row.name) },
	{
		id: "plays",
		header: m.pd_admin_col_plays_range,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatNumber(row.plays),
	},
	{
		id: "failed",
		header: m.pd_admin_col_failed,
		headClassName: "text-end",
		cellClassName: NUMBER_CELL,
		cell: (row) => formatNumber(row.failed),
	},
	{
		id: "rate",
		header: m.pd_admin_col_failure_rate,
		cell: (row) => (
			<span className="flex min-w-32 items-center gap-2">
				<span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
					<span className="block h-full bg-primary" style={{ width: `${row.failureRate * 100}%` }} />
				</span>
				<span className="w-12 text-end text-caption tabular-nums">{percent(row.failureRate)}</span>
			</span>
		),
	},
];

/** A short list of searches with how often each was made. */
function SearchList({
	title,
	rows,
	empty,
	testId,
}: {
	title: string;
	rows: ReadonlyArray<{ query: string; count: number }>;
	empty: string;
	testId: string;
}) {
	return (
		<section className="flex flex-col gap-3 rounded-lg border p-4" data-testid={testId}>
			<h2 className="text-heading">{title}</h2>
			{rows.length === 0 ? (
				<p className="text-muted-foreground text-sm">{empty}</p>
			) : (
				<ol className="flex flex-col gap-1.5" data-figures>
					{rows.map((row) => (
						<li key={row.query} className="flex items-baseline justify-between gap-4 text-sm">
							<span className="min-w-0 truncate" lang="und">
								{row.query}
							</span>
							<span className="shrink-0 text-muted-foreground tabular-nums">{formatNumber(row.count)}</span>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}

/**
 * /admin/parda (PLAN Task 69, decision 0242): how Parda is being watched. Plays in each
 * window, then the chosen range's viewers, watch time and failures, the plays of the last
 * 30 days by kind of viewer, top titles and searches, and how often each server failed.
 */
export function PardaOverview({ range }: { range: PardaOverviewRange }) {
	const { data } = useSuspenseQuery(pardaOverviewQueryOptions(range));
	const days = data.days.map((row) => ({
		day: formatDayMonth(row.day),
		account: row.account,
		guest: row.guest,
		anonymous: row.anonymous,
	}));
	const trend = data.days.map((row) => row.account + row.guest + row.anonymous);
	return (
		<Page width="admin" data-testid="parda-admin-overview">
			<PageHeader
				title={PARDA_NAME}
				description={m.pd_admin_overview_description()}
				actions={
					<SegmentNav
						label={m.pd_admin_range_nav()}
						items={PARDA_OVERVIEW_RANGES.map((value) => ({ value, label: RANGE_LABELS[value]() }))}
						current={range}
						link={(value) => linkOptions({ to: "/admin/parda", search: { range: value } })}
						testId="parda-range"
					/>
				}
			/>
			<section aria-labelledby="pd-overview-plays">
				<h2 id="pd-overview-plays" className="sr-only">
					{m.pd_admin_overview_plays()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard label={m.pd_admin_stat_plays_today()} value={data.plays.today} icon={PlayIcon} />
					<StatCard label={m.pd_admin_stat_plays_week()} value={data.plays.week} icon={PlayIcon} />
					<StatCard label={m.pd_admin_stat_plays_month()} value={data.plays.month} icon={PlayIcon} trend={trend} />
					<StatCard
						label={m.pd_admin_stat_open_reports()}
						value={data.openReports}
						icon={FlagIcon}
						to="/admin/parda/reports"
					/>
				</div>
			</section>
			<section aria-labelledby="pd-overview-range">
				<h2 id="pd-overview-range" className="sr-only">
					{RANGE_LABELS[range]()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						label={m.pd_admin_stat_viewers()}
						value={data.viewersPerDay}
						format={(value) => formatNumber(value, { maximumFractionDigits: 1 })}
						icon={UsersIcon}
						hint={m.pd_admin_stat_viewers_hint()}
					/>
					<StatCard label={m.pd_admin_stat_watched()} value={data.watchedS} format={hours} icon={ClockIcon} />
					<StatCard
						label={m.pd_admin_stat_failures()}
						value={data.failureRate ?? 0}
						format={(value) => (data.failureRate === null ? "–" : percent(value))}
						icon={TriangleAlertIcon}
					/>
					<StatCard
						label={m.pd_admin_stat_guests()}
						value={data.byKind.guest + data.byKind.anonymous}
						icon={ActivityIcon}
						hint={m.pd_admin_stat_guests_hint({
							accounts: formatNumber(data.byKind.account),
							guests: formatNumber(data.byKind.guest),
							anonymous: formatNumber(data.byKind.anonymous),
						})}
					/>
				</div>
			</section>
			<section aria-labelledby="pd-overview-days" className="flex flex-col gap-3 rounded-lg border p-4">
				<h2 id="pd-overview-days" className="text-heading">
					{m.pd_admin_overview_days_title()}
				</h2>
				<BarChart
					stacked
					label={m.pd_admin_overview_days_label()}
					data={days}
					index="day"
					series={[
						{ key: "account", label: m.pd_admin_series_account() },
						{ key: "guest", label: m.pd_admin_series_guest() },
						{ key: "anonymous", label: m.pd_admin_series_anonymous() },
					]}
				/>
			</section>
			<section aria-labelledby="pd-overview-titles" className="flex flex-col gap-3">
				<h2 id="pd-overview-titles" className="text-heading">
					{m.pd_admin_overview_titles_title()}
				</h2>
				<DataTable
					tableId="admin-parda-top-titles"
					rows={data.topTitles}
					columns={titleColumns}
					getRowId={(row) => `${row.media}:${row.tmdbId}`}
					getRowLabel={titleText}
					empty={<p className="p-6 text-center text-muted-foreground">{m.pd_admin_overview_titles_empty()}</p>}
					data-testid="parda-top-titles"
				/>
			</section>
			<div className="grid gap-4 lg:grid-cols-2">
				<SearchList
					title={m.pd_admin_overview_searches_title()}
					rows={data.topSearches}
					empty={m.pd_admin_overview_searches_empty()}
					testId="parda-top-searches"
				/>
				<SearchList
					title={m.pd_admin_overview_zero_title()}
					rows={data.zeroSearches}
					empty={m.pd_admin_overview_zero_empty()}
					testId="parda-zero-searches"
				/>
			</div>
			<section aria-labelledby="pd-overview-servers" className="flex flex-col gap-3">
				<h2 id="pd-overview-servers" className="text-heading">
					{m.pd_admin_overview_servers_title()}
				</h2>
				<DataTable
					tableId="admin-parda-servers"
					rows={data.servers}
					columns={serverColumns}
					getRowId={(row) => row.id}
					getRowLabel={(row) => localizedValue(row.name)}
					empty={<p className="p-6 text-center text-muted-foreground">{m.pd_admin_overview_servers_empty()}</p>}
					data-testid="parda-servers"
				/>
			</section>
		</Page>
	);
}

export function PardaOverviewPage() {
	const { range } = route.useSearch();
	return <PardaOverview range={range} />;
}
