import { useSuspenseQuery } from "@tanstack/react-query";
import { HandCoinsIcon, MailIcon, ReceiptIcon, UserRoundIcon, UsersIcon } from "lucide-react";
import { BarChart, LineChart } from "@/components/charts";
import { StatCard } from "@/components/data-display/stat-card";
import { Page, PageHeader } from "@/components/page/page";
import { formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { KHARCHA_NAME } from "../../brand";
import { kharchaOverviewQueryOptions } from "../queries";

/** A titled panel around one chart. */
function ChartPanel({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
	return (
		<section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border p-4">
			<h2 id={id} className="text-heading">
				{title}
			</h2>
			{children}
		</section>
	);
}

/**
 * /admin/kharcha (PLAN Task 96, decision 0290): how Kharcha is used, in counts only (0186).
 * People with data and active over 7 and 30 days, then the last 30 days: what was made a
 * day, invites sent and taken, and guests trying it.
 */
export function KharchaOverviewPage() {
	const { data } = useSuspenseQuery(kharchaOverviewQueryOptions());
	const days = data.days.map((row) => ({ ...row, day: formatDayMonth(row.day) }));
	const { totals } = data;
	return (
		<Page width="admin" data-testid="kharcha-admin-overview">
			<PageHeader title={KHARCHA_NAME} description={m.kharcha_admin_overview_description()} />
			<section aria-labelledby="kh-overview-people">
				<h2 id="kh-overview-people" className="sr-only">
					{m.kharcha_admin_overview_people()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						label={m.kharcha_admin_stat_people()}
						value={data.people}
						icon={UserRoundIcon}
						hint={m.kharcha_admin_stat_people_hint({ count: formatNumber(totals.people) })}
					/>
					<StatCard
						label={m.kharcha_admin_stat_active_week()}
						value={data.active.week}
						icon={UsersIcon}
						trend={data.days.slice(-7).map((row) => row.active)}
					/>
					<StatCard
						label={m.kharcha_admin_stat_active_month()}
						value={data.active.month}
						icon={UsersIcon}
						trend={data.days.map((row) => row.active)}
					/>
					<StatCard
						label={m.kharcha_admin_stat_guests()}
						value={totals.guests}
						icon={UserRoundIcon}
						trend={data.days.map((row) => row.guests)}
					/>
				</div>
			</section>
			<section aria-labelledby="kh-overview-month">
				<h2 id="kh-overview-month" className="sr-only">
					{m.kharcha_admin_overview_month()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						label={m.kharcha_admin_stat_expenses()}
						value={totals.expenses}
						icon={ReceiptIcon}
						hint={m.kharcha_admin_stat_receipts_hint({ count: formatNumber(totals.receipts) })}
					/>
					<StatCard label={m.kharcha_admin_stat_payments()} value={totals.payments} icon={HandCoinsIcon} />
					<StatCard label={m.kharcha_admin_stat_groups()} value={totals.groups} icon={UsersIcon} />
					<StatCard
						label={m.kharcha_admin_stat_invites()}
						value={totals.invitesSent}
						icon={MailIcon}
						hint={m.kharcha_admin_stat_invites_hint({ count: formatNumber(totals.invitesAccepted) })}
						to="/admin/kharcha/senders"
					/>
				</div>
			</section>
			<div className="grid gap-4 lg:grid-cols-2">
				<ChartPanel id="kh-overview-made" title={m.kharcha_admin_overview_made_title()}>
					<BarChart
						stacked
						label={m.kharcha_admin_overview_made_label()}
						data={days}
						index="day"
						series={[
							{ key: "expenses", label: m.kharcha_admin_series_expenses() },
							{ key: "payments", label: m.kharcha_admin_series_payments() },
						]}
					/>
				</ChartPanel>
				<ChartPanel id="kh-overview-active" title={m.kharcha_admin_overview_active_title()}>
					<LineChart
						label={m.kharcha_admin_overview_active_label()}
						data={days}
						index="day"
						series={[
							{ key: "active", label: m.kharcha_admin_series_active() },
							{ key: "guests", label: m.kharcha_admin_series_guests() },
						]}
					/>
				</ChartPanel>
				<ChartPanel id="kh-overview-groups" title={m.kharcha_admin_overview_groups_title()}>
					<BarChart
						label={m.kharcha_admin_overview_groups_label()}
						data={days}
						index="day"
						series={[
							{ key: "groups", label: m.kharcha_admin_series_groups() },
							{ key: "receipts", label: m.kharcha_admin_series_receipts() },
						]}
					/>
				</ChartPanel>
				<ChartPanel id="kh-overview-invites" title={m.kharcha_admin_overview_invites_title()}>
					<LineChart
						label={m.kharcha_admin_overview_invites_label()}
						data={days}
						index="day"
						series={[
							{ key: "invitesSent", label: m.kharcha_admin_series_sent() },
							{ key: "invitesAccepted", label: m.kharcha_admin_series_accepted() },
						]}
					/>
				</ChartPanel>
			</div>
		</Page>
	);
}
