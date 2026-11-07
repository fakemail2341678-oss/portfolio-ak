import { createFileRoute } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { getDbHealth } from "@/functions/health";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public/health")({
	loader: () => getDbHealth(),
	// Always re-check; a cached health result is meaningless.
	staleTime: 0,
	gcTime: 0,
	head: () => privateHead(m.health_title()),
	component: HealthPage,
});

function HealthPage() {
	const health = Route.useLoaderData();
	const ok = health.status === "ok";
	return (
		<main {...MAIN_CONTENT} className="mx-auto max-w-3xl px-4 py-16">
			<h1 className="font-semibold text-2xl tracking-tight">{m.health_title()}</h1>
			<dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
				<dt className="text-muted-foreground">{m.health_database()}</dt>
				<dd data-testid="db-status" className={ok ? "text-green-700 dark:text-green-400" : "text-destructive"}>
					{ok ? m.health_status_ok() : m.health_status_error()}
				</dd>
				<dt className="text-muted-foreground">{m.health_latency()}</dt>
				<dd>{m.health_latency_value({ value: formatNumber(health.latencyMs) })}</dd>
				<dt className="text-muted-foreground">{m.health_checked_at()}</dt>
				<dd>
					<time dateTime={health.checkedAt}>{formatDateTime(health.checkedAt)}</time>
				</dd>
			</dl>
		</main>
	);
}
