import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, DatabaseIcon, ScrollTextIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { DonutChart } from "@/components/charts";
import { ActivityFeed } from "@/components/data-display/activity-feed";
import { StatCard } from "@/components/data-display/stat-card";
import { EmptyState } from "@/components/page/empty-state";
import { FormCard } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { permittedCommands } from "@/features/admin/commands";
import type { Dashboard as DashboardData } from "@/features/admin/dashboard";
import { dashboardQueryOptions } from "@/features/admin/queries";
import { AUDIT_ACTION_LABELS } from "@/features/audit/labels";
import { usePermissions } from "@/features/rbac/can";
import { TEST_CRUD_STATUS } from "@/features/test-crud/labels";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";

/**
 * The admin home: totals for the sections the user may read, the latest audit
 * events and the feature actions they may run. Every number comes from one server
 * function (getDashboard), loaded before the page renders.
 */
export function Dashboard() {
	const { data } = useSuspenseQuery(dashboardQueryOptions());
	const commands = permittedCommands(usePermissions());
	const hasStats = Boolean(data.testCrud || data.users || data.roles);
	return (
		<Page width="admin">
			<PageHeader title={m.admin_nav_dashboard()} description={m.admin_dashboard_description()} />
			{hasStats ? (
				<section aria-labelledby="dashboard-stats" className="flex flex-col gap-3">
					<h2 id="dashboard-stats" className="sr-only">
						{m.dashboard_stats_title()}
					</h2>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<Stats data={data} />
					</div>
				</section>
			) : null}
			<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				{data.activity ? <Activity events={data.activity} now={data.generatedAt} /> : null}
				<div className="flex min-w-0 flex-col gap-4">
					{data.testCrud ? (
						<FormCard title={m.dashboard_status_title()} description={m.dashboard_status_description()}>
							<DonutChart
								label={m.dashboard_status_title()}
								index="status"
								series={[{ key: "count", label: m.dashboard_status_count() }]}
								data={[
									{ status: TEST_CRUD_STATUS.published.label(), count: data.testCrud.published },
									{ status: TEST_CRUD_STATUS.draft.label(), count: data.testCrud.draft },
								]}
							/>
						</FormCard>
					) : null}
					<section
						aria-labelledby="dashboard-actions"
						className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 shadow-xs"
					>
						<h2 id="dashboard-actions" className="text-heading">
							{m.dashboard_actions_title()}
						</h2>
						<ul className="flex flex-col gap-1">
							{commands.map((command) => (
								<li key={command.id}>
									<Button asChild variant="ghost" className="w-full justify-start">
										<Link to={command.to}>
											<command.icon aria-hidden className="text-primary" />
											{command.label()}
										</Link>
									</Button>
								</li>
							))}
							<li>
								<Button asChild variant="ghost" className="w-full justify-start">
									<Link to="/admin/settings/appearance">
										<ArrowRightIcon aria-hidden className="text-muted-foreground rtl:rotate-180" />
										{m.dashboard_action_appearance()}
									</Link>
								</Button>
							</li>
						</ul>
						<p className="text-caption text-muted-foreground">{m.dashboard_palette_hint()}</p>
					</section>
				</div>
			</div>
		</Page>
	);
}

function Stats({ data }: { data: DashboardData }) {
	const week = m.dashboard_this_week();
	return (
		<>
			{data.testCrud ? (
				<StatCard
					label={m.admin_nav_test_crud()}
					value={data.testCrud.total}
					icon={DatabaseIcon}
					delta={{ value: data.testCrud.recent, label: week }}
					hint={m.dashboard_test_crud_hint({
						published: formatNumber(data.testCrud.published),
						drafts: formatNumber(data.testCrud.draft),
					})}
					to="/admin/test-crud"
				/>
			) : null}
			{data.users ? (
				<StatCard
					label={m.admin_nav_users()}
					value={data.users.total}
					icon={UsersIcon}
					delta={{ value: data.users.recent, label: week }}
					hint={m.dashboard_users_hint({ banned: formatNumber(data.users.banned) })}
					to="/admin/users"
				/>
			) : null}
			{data.roles ? (
				<StatCard label={m.admin_nav_roles()} value={data.roles.total} icon={ShieldCheckIcon} to="/admin/roles" />
			) : null}
		</>
	);
}

function Activity({ events, now }: { events: NonNullable<DashboardData["activity"]>; now: string }) {
	return (
		<FormCard
			title={m.dashboard_activity_title()}
			action={
				<Button asChild variant="link" size="sm" className="h-auto min-h-6 p-0">
					<Link to="/admin/audit">{m.dashboard_activity_all()}</Link>
				</Button>
			}
		>
			{events.length === 0 ? (
				<EmptyState icon={ScrollTextIcon} description={m.dashboard_activity_empty()} className="border-0 py-6" />
			) : (
				<ActivityFeed
					now={now}
					events={events.map((event) => ({
						id: event.id,
						actor: event.actor,
						action: AUDIT_ACTION_LABELS[event.action](),
						target: event.target.label ?? event.target.id,
						at: event.createdAt,
					}))}
				/>
			)}
		</FormCard>
	);
}
