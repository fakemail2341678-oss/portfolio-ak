import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ActivityIcon, CircleAlertIcon, HourglassIcon, RadioTowerIcon, TimerIcon } from "lucide-react";
import { BarChart } from "@/components/charts";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatCard } from "@/components/data-display/stat-card";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { SegmentNav } from "@/components/navigation/segment-nav";
import { FormCard } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/rbac/can";
import { formatDate, formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { HEALTH_RANGE_LABELS } from "../labels";
import { chaalAdminMutations, chaalHealthQueryOptions } from "../queries";
import type { ChaalHealth, ChaalHealthEndpoint, ChaalHealthError, ChaalPing } from "../schema";
import { CHAAL_HEALTH_RANGES, type ChaalHealthRange } from "../search";

const route = getRouteApi("/_admin/admin/chaal/health");

const ms = (value: number) => m.ch_admin_health_ms({ ms: formatNumber(value) });

const endpointColumns: ReadonlyArray<DataTableColumn<ChaalHealthEndpoint>> = [
	{ id: "endpoint", header: m.ch_admin_col_endpoint, cell: (row) => <code className="text-xs">{row.endpoint}</code> },
	{
		id: "calls",
		header: m.ch_admin_col_calls,
		headClassName: "text-end",
		cellClassName: "text-end tabular-nums",
		cell: (row) => formatNumber(row.calls),
	},
	{
		id: "errors",
		header: m.ch_admin_col_errors,
		headClassName: "text-end",
		cellClassName: "text-end tabular-nums",
		cell: (row) => formatNumber(row.errors),
	},
	{
		id: "rateLimited",
		header: m.ch_admin_col_rate_limited,
		headClassName: "text-end",
		cellClassName: "text-end tabular-nums",
		cell: (row) => formatNumber(row.rateLimited),
	},
	{
		id: "avg",
		header: m.ch_admin_col_avg,
		headClassName: "text-end",
		cellClassName: "text-end tabular-nums",
		cell: (row) => ms(row.avgMs),
	},
];

const errorColumns: ReadonlyArray<DataTableColumn<ChaalHealthError>> = [
	{
		id: "at",
		header: m.ch_admin_col_at,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.at),
	},
	{ id: "endpoint", header: m.ch_admin_col_endpoint, cell: (row) => <code className="text-xs">{row.endpoint}</code> },
	{
		id: "status",
		header: m.ch_admin_col_status,
		cellClassName: "tabular-nums",
		cell: (row) => (row.status === 0 ? m.ch_admin_health_no_answer() : String(row.status)),
	},
	{ id: "lane", header: m.ch_admin_col_lane, cell: (row) => row.lane },
	{
		id: "ms",
		header: m.ch_admin_col_time,
		headClassName: "text-end",
		cellClassName: "text-end tabular-nums",
		cell: (row) => ms(row.ms),
	},
];

/** The hour's label on the chart's axis: the time alone for a day, the day and time for a week. */
const hourLabel = (iso: string, range: ChaalHealthRange) =>
	formatDate(iso, range === "24h" ? { timeStyle: "short" } : { dateStyle: "short", timeStyle: "short" });

function PingCard() {
	const canConfigure = useCan("chaal:configure");
	const ping = useCrudMutation(chaalAdminMutations.ping(), { invalidate: [] });
	const result: ChaalPing | undefined = ping.data;
	return (
		<FormCard title={m.ch_admin_ping_title()} description={m.ch_admin_ping_description()}>
			<div className="flex flex-wrap items-center gap-4">
				{canConfigure ? (
					<Button variant="outline" onClick={() => ping.mutate()} disabled={ping.isPending} data-testid="chaal-ping">
						<RadioTowerIcon aria-hidden />
						{m.ch_admin_ping_action()}
					</Button>
				) : null}
				<output className="text-sm" data-testid="chaal-ping-result">
					{result
						? result.ok
							? m.ch_admin_ping_ok({ ms: formatNumber(result.ms) })
							: result.reason === "wait"
								? m.ch_admin_ping_wait()
								: m.ch_admin_ping_down({ ms: formatNumber(result.ms) })
						: null}
				</output>
			</div>
		</FormCard>
	);
}

function Cooldowns({ cooldowns }: { cooldowns: ChaalHealth["cooldowns"] }) {
	const none = !cooldowns.public && cooldowns.connections.length === 0;
	return (
		<section aria-labelledby="ch-health-cooldowns" className="flex flex-col gap-3 rounded-lg border p-4">
			<h2 id="ch-health-cooldowns" className="text-heading">
				{m.ch_admin_health_cooldowns()}
			</h2>
			{none ? (
				<p className="text-muted-foreground text-sm" data-testid="chaal-cooldowns-none">
					{m.ch_admin_health_cooldowns_none()}
				</p>
			) : (
				<ul className="flex flex-col gap-1 text-sm" data-testid="chaal-cooldowns">
					{cooldowns.public ? (
						<li>{m.ch_admin_health_cooldown_public({ until: formatDateTime(cooldowns.public) })}</li>
					) : null}
					{cooldowns.connections.map((each) => (
						<li key={each.username}>
							{m.ch_admin_health_cooldown_connection({
								username: each.username,
								until: formatDateTime(each.until),
							})}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

/**
 * /admin/chaal/health (PLAN Task 79, decision 0268): every server's Lichess calls, errors
 * and 429s by hour and by endpoint class, the cooldowns running now, the last failed calls,
 * and "Test Lichess". The counts arrive after each call (they're flushed in the background),
 * so a call shows within moments.
 */
export function ChaalHealthView({ range }: { range: ChaalHealthRange }) {
	const { data } = useSuspenseQuery(chaalHealthQueryOptions(range));
	const chart = data.hours.map((hour) => ({
		hour: hourLabel(hour.hour, range),
		ok: hour.calls - hour.errors,
		errors: hour.errors - hour.rateLimited,
		rateLimited: hour.rateLimited,
	}));
	const errorRate = data.totals.calls > 0 ? data.totals.errors / data.totals.calls : 0;
	return (
		<Page width="admin" data-testid="chaal-admin-health">
			<PageHeader
				title={m.ch_admin_health_title()}
				description={m.ch_admin_health_description()}
				actions={
					<SegmentNav
						label={m.ch_admin_health_range()}
						items={CHAAL_HEALTH_RANGES.map((value) => ({ value, label: HEALTH_RANGE_LABELS[value]() }))}
						current={range}
						link={(value) => ({ to: "/admin/chaal/health", search: { range: value } })}
						testId="chaal-health-range"
					/>
				}
			/>
			<section aria-labelledby="ch-health-totals">
				<h2 id="ch-health-totals" className="sr-only">
					{HEALTH_RANGE_LABELS[range]()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard label={m.ch_admin_col_calls()} value={data.totals.calls} icon={ActivityIcon} />
					<StatCard
						label={m.ch_admin_col_errors()}
						value={data.totals.errors}
						icon={CircleAlertIcon}
						hint={m.ch_admin_health_error_rate({
							rate: formatNumber(errorRate, { style: "percent", maximumFractionDigits: 1 }),
						})}
					/>
					<StatCard label={m.ch_admin_col_rate_limited()} value={data.totals.rateLimited} icon={HourglassIcon} />
					<StatCard label={m.ch_admin_col_avg()} value={data.totals.avgMs} format={ms} icon={TimerIcon} />
				</div>
			</section>
			<section aria-labelledby="ch-health-hours" className="flex flex-col gap-3 rounded-lg border p-4">
				<h2 id="ch-health-hours" className="text-heading">
					{m.ch_admin_health_hours()}
				</h2>
				<BarChart
					stacked
					label={m.ch_admin_health_hours_label()}
					data={chart}
					index="hour"
					series={[
						{ key: "ok", label: m.ch_admin_series_ok() },
						{ key: "errors", label: m.ch_admin_series_errors() },
						{ key: "rateLimited", label: m.ch_admin_col_rate_limited() },
					]}
				/>
			</section>
			<div className="grid gap-4 lg:grid-cols-2">
				<Cooldowns cooldowns={data.cooldowns} />
				<PingCard />
			</div>
			<div className="flex flex-col gap-3">
				<h2 id="ch-health-endpoints" className="text-heading">
					{m.ch_admin_health_endpoints()}
				</h2>
				<DataTable
					tableId="chaal-health-endpoints"
					scrollRegion
					scrollRegionLabel={m.ch_admin_health_endpoints()}
					rows={data.endpoints}
					columns={endpointColumns}
					getRowId={(row) => row.endpoint}
					getRowLabel={(row) => row.endpoint}
					empty={<p className="p-6 text-center text-muted-foreground">{m.ch_admin_health_endpoints_empty()}</p>}
					data-testid="chaal-health-endpoints"
				/>
			</div>
			<div className="flex flex-col gap-3">
				<h2 id="ch-health-errors" className="text-heading">
					{m.ch_admin_health_errors()}
				</h2>
				<DataTable
					tableId="chaal-health-errors"
					scrollRegion
					scrollRegionLabel={m.ch_admin_health_errors()}
					rows={data.errors}
					columns={errorColumns}
					getRowId={(row) => row.id}
					getRowLabel={(row) => `${row.endpoint} ${row.at}`}
					empty={<p className="p-6 text-center text-muted-foreground">{m.ch_admin_health_errors_empty()}</p>}
					data-testid="chaal-health-errors"
				/>
			</div>
		</Page>
	);
}

/** The route's page: the range from the URL. */
export function ChaalHealthPage() {
	const { range } = route.useSearch();
	return <ChaalHealthView range={range} />;
}
