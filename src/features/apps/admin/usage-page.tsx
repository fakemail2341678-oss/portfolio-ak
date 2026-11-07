import { useSuspenseQuery } from "@tanstack/react-query";
import { DatabaseIcon, UserRoundIcon, UsersIcon } from "lucide-react";
import { BarChart } from "@/components/charts";
import { StatCard } from "@/components/data-display/stat-card";
import { Page, PageHeader } from "@/components/page/page";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { appBySlug } from "../registry";
import { appsUsageQueryOptions } from "./queries";

/**
 * /admin/apps (decision 0187): how the showcase apps are used. Guests alive now, and per
 * app the accounts and guests with data in it and its rows. Counts only, never content.
 */
export function AppsUsagePage() {
	const { data: usage } = useSuspenseQuery(appsUsageQueryOptions());
	const accounts = usage.apps.reduce((total, app) => total + app.accounts, 0);
	const rows = usage.apps.reduce(
		(total, app) => total + Object.values(app.rows).reduce((sum, value) => sum + value, 0),
		0,
	);
	const people = usage.apps.map((app) => ({
		app: appBySlug(app.slug).name(),
		accounts: app.accounts,
		guests: app.guests,
	}));
	return (
		<Page width="admin" data-testid="apps-usage">
			<PageHeader title={m.apps_usage_title()} description={m.apps_usage_description()} />
			<section aria-labelledby="apps-usage-stats">
				<h2 id="apps-usage-stats" className="sr-only">
					{m.dashboard_stats_title()}
				</h2>
				<div className="grid gap-4 sm:grid-cols-3">
					<StatCard
						label={m.apps_usage_guests()}
						value={usage.guests}
						icon={UserRoundIcon}
						hint={m.apps_usage_guests_hint()}
					/>
					<StatCard label={m.apps_usage_accounts()} value={accounts} icon={UsersIcon} />
					<StatCard label={m.apps_usage_rows()} value={rows} icon={DatabaseIcon} />
				</div>
			</section>
			<section aria-labelledby="apps-usage-people" className="flex flex-col gap-3 rounded-lg border p-4">
				<h2 id="apps-usage-people" className="text-heading">
					{m.apps_usage_people_title()}
				</h2>
				<BarChart
					label={m.apps_usage_people_label()}
					data={people}
					index="app"
					stacked
					series={[
						{ key: "accounts", label: m.apps_usage_accounts() },
						{ key: "guests", label: m.apps_usage_guest_series() },
					]}
				/>
			</section>
			<section aria-labelledby="apps-usage-rows" className="flex flex-col gap-3">
				<h2 id="apps-usage-rows" className="text-heading">
					{m.apps_usage_rows_title()}
				</h2>
				<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{usage.apps.map((app) => {
						const entry = appBySlug(app.slug);
						return (
							<li key={app.slug} className="flex flex-col gap-2 rounded-lg border bg-surface-1 p-4">
								<span className="flex items-center gap-2 font-medium">
									<entry.icon className="size-4 text-muted-foreground" aria-hidden />
									{entry.name()}
								</span>
								<dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-body">
									{Object.entries(app.rows).map(([key, value]) => (
										<div key={key} className="contents">
											<dt className="text-muted-foreground">{entry.rows[key]?.() ?? key}</dt>
											<dd className="text-end tabular-nums">{formatNumber(value)}</dd>
										</div>
									))}
								</dl>
							</li>
						);
					})}
				</ul>
			</section>
		</Page>
	);
}
