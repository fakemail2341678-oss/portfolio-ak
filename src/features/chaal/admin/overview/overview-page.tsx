import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, linkOptions } from "@tanstack/react-router";
import { ChartSplineIcon, LinkIcon, PuzzleIcon, SwordsIcon, UsersIcon } from "lucide-react";
import { BarChart, LineChart } from "@/components/charts";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { SegmentNav } from "@/components/navigation/segment-nav";
import { Page, PageHeader } from "@/components/page/page";
import { formatDateTime, formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { CHAAL_NAME } from "../../brand";
import { GAME_MODE_LABELS, OVERVIEW_RANGE_LABELS } from "../labels";
import { chaalOverviewQueryOptions } from "../queries";
import { CHAAL_GAME_MODES, type ChaalOverview } from "../schema";
import { CHAAL_OVERVIEW_RANGES, type ChaalOverviewRange } from "../search";

const route = getRouteApi("/_admin/admin/chaal/");

const percent = (value: number) => formatNumber(value, { style: "percent", maximumFractionDigits: 1 });

/** Six modes and their counts: a list with meters says how many games each share rests on. */
function Modes({ data }: { data: ChaalOverview }) {
	const most = Math.max(1, ...CHAAL_GAME_MODES.map((mode) => data.modes[mode]));
	return (
		<section aria-labelledby="ch-overview-modes" className="flex flex-col gap-3 rounded-lg border p-4">
			<h2 id="ch-overview-modes" className="text-heading">
				{m.ch_admin_overview_modes_title()}
			</h2>
			<dl className="flex flex-col gap-2" data-testid="chaal-overview-modes">
				{CHAAL_GAME_MODES.map((mode) => (
					<div key={mode} className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-sm">
						<dt className="truncate">{GAME_MODE_LABELS[mode]()}</dt>
						<dd className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
							<span className="block h-full bg-primary" style={{ width: `${(data.modes[mode] / most) * 100}%` }} />
						</dd>
						<dd className="text-end tabular-nums">{formatNumber(data.modes[mode])}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

/** The last 24 hours of Lichess calls, linking to the health page for the rest. */
function Api({ api }: { api: ChaalOverview["api"] }) {
	const items = [
		{ label: m.ch_admin_col_calls(), value: formatNumber(api.calls) },
		{ label: m.ch_admin_col_errors(), value: api.calls === 0 ? "–" : percent(api.errors / api.calls) },
		{ label: m.ch_admin_col_rate_limited(), value: formatNumber(api.rateLimited) },
		{ label: m.ch_admin_col_avg(), value: m.ch_admin_health_ms({ ms: formatNumber(Math.round(api.avgMs)) }) },
	];
	return (
		<section aria-labelledby="ch-overview-api" className="flex flex-col gap-3 rounded-lg border p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="ch-overview-api" className="text-heading">
					{m.ch_admin_overview_api_title()}
				</h2>
				{api.cooldown ? (
					<StatusBadge tone="warning">
						{m.ch_admin_overview_cooldown({ until: formatDateTime(api.cooldown) })}
					</StatusBadge>
				) : (
					<StatusBadge tone="success">{m.ch_admin_overview_api_ok()}</StatusBadge>
				)}
			</div>
			<dl className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="chaal-overview-api">
				{items.map((item) => (
					<div key={item.label} className="flex flex-col gap-0.5">
						<dt className="text-muted-foreground text-sm">{item.label}</dt>
						<dd className="font-semibold text-lg tabular-nums">{item.value}</dd>
					</div>
				))}
			</dl>
			<Link to="/admin/chaal/health" className="self-start text-sm underline underline-offset-4">
				{m.ch_admin_overview_api_more()}
			</Link>
		</section>
	);
}

/**
 * /admin/chaal (PLAN Task 84, decision 0274): how Chaal is used. Players connected and
 * active, then the range's games, puzzles, analyses and connections, players and games a
 * day over 30 days, games by mode, and the Lichess API's last 24 hours.
 */
export function ChaalOverviewView({ range }: { range: ChaalOverviewRange }) {
	const { data } = useSuspenseQuery(chaalOverviewQueryOptions(range));
	const days = data.days.map((row) => ({ ...row, day: formatDayMonth(row.day) }));
	return (
		<Page width="admin" data-testid="chaal-admin-overview">
			<PageHeader
				title={CHAAL_NAME}
				description={m.ch_admin_overview_description()}
				actions={
					<SegmentNav
						label={m.ch_admin_range_nav()}
						items={CHAAL_OVERVIEW_RANGES.map((value) => ({ value, label: OVERVIEW_RANGE_LABELS[value]() }))}
						current={range}
						link={(value) => linkOptions({ to: "/admin/chaal", search: { range: value } })}
						testId="chaal-range"
					/>
				}
			/>
			<section aria-labelledby="ch-overview-players">
				<h2 id="ch-overview-players" className="sr-only">
					{m.ch_admin_overview_players()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-3">
					<StatCard
						label={m.ch_admin_stat_connected()}
						value={data.connected}
						icon={LinkIcon}
						to="/admin/chaal/connections"
					/>
					<StatCard
						label={m.ch_admin_stat_active_week()}
						value={data.players.week}
						icon={UsersIcon}
						trend={data.days.slice(-7).map((row) => row.players)}
					/>
					<StatCard
						label={m.ch_admin_stat_active_month()}
						value={data.players.month}
						icon={UsersIcon}
						trend={data.days.map((row) => row.players)}
					/>
				</div>
			</section>
			<section aria-labelledby="ch-overview-range">
				<h2 id="ch-overview-range" className="sr-only">
					{OVERVIEW_RANGE_LABELS[range]()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard label={m.ch_admin_stat_games()} value={data.totals.games} icon={SwordsIcon} />
					<StatCard
						label={m.ch_admin_stat_puzzles()}
						value={data.totals.puzzlesSolved}
						icon={PuzzleIcon}
						hint={m.ch_admin_stat_puzzles_hint({ played: formatNumber(data.totals.puzzles) })}
					/>
					<StatCard label={m.ch_admin_stat_analyses()} value={data.totals.analyses} icon={ChartSplineIcon} />
					<StatCard label={m.ch_admin_stat_connects()} value={data.totals.connects} icon={LinkIcon} />
				</div>
			</section>
			<div className="grid gap-4 lg:grid-cols-2">
				<section aria-labelledby="ch-overview-days-players" className="flex flex-col gap-3 rounded-lg border p-4">
					<h2 id="ch-overview-days-players" className="text-heading">
						{m.ch_admin_overview_players_title()}
					</h2>
					<LineChart
						label={m.ch_admin_overview_players_label()}
						data={days}
						index="day"
						series={[{ key: "players", label: m.ch_admin_series_players() }]}
					/>
				</section>
				<section aria-labelledby="ch-overview-days-games" className="flex flex-col gap-3 rounded-lg border p-4">
					<h2 id="ch-overview-days-games" className="text-heading">
						{m.ch_admin_overview_games_title()}
					</h2>
					<BarChart
						stacked
						label={m.ch_admin_overview_games_label()}
						data={days}
						index="day"
						series={[
							{ key: "online", label: m.ch_admin_series_online() },
							{ key: "local", label: m.ch_admin_series_local() },
						]}
					/>
				</section>
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<Modes data={data} />
				<Api api={data.api} />
			</div>
		</Page>
	);
}

export function ChaalOverviewPage() {
	const { range } = route.useSearch();
	return <ChaalOverviewView range={range} />;
}
