import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { homeFlagsQueryOptions } from "@/features/flags/queries";
import { formatCurrency, formatDate, formatNumber, formatRelativeTimeFrom } from "@/lib/i18n/intl";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /dev: the demo home (feature flags, Intl formatting), a starting point for the references below it. */
export const Route = createFileRoute("/dev/")({
	// Feature flags are evaluated on the server and SSR'd with the page (see feature-flags.ts).
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { homeFlagsQueryOptions } = await import("@/features/flags/queries");
		return ensureQuery(context.queryClient, homeFlagsQueryOptions());
	},
	head: () => privateHead(m.nav_dev()),
	component: Home,
});

// Fixed sample values: identical on server and client, so formatting can't cause hydration mismatches.
const SAMPLE_DATE = "2026-01-15T10:30:00Z";
const SAMPLE_NOW = "2026-01-18T10:30:00Z";

function Home() {
	const { data: flags } = useSuspenseQuery(homeFlagsQueryOptions());
	const rows = [
		{ label: m.intl_date(), value: formatDate(SAMPLE_DATE, { dateStyle: "full" }) },
		{ label: m.intl_number(), value: formatNumber(1234567.89) },
		{ label: m.intl_currency(), value: formatCurrency(1234567.5) },
		{ label: m.intl_relative_time(), value: formatRelativeTimeFrom(SAMPLE_DATE, SAMPLE_NOW) },
	];

	return (
		<main {...MAIN_CONTENT} className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16">
			<div className="flex flex-col gap-2">
				<h1 className="font-semibold text-4xl tracking-tight">{m.home_title()}</h1>
				<p className="text-lg text-muted-foreground">{m.home_intro()}</p>
			</div>
			{flags.showItemsCta ? (
				<Card data-testid="items-cta" className="border-primary/40">
					<CardHeader>
						<CardTitle>{m.home_items_cta_title()}</CardTitle>
						<CardDescription>{m.home_items_cta_body()}</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<Link to="/dev/test-crud">
								{m.home_items_cta_link()}
								<ArrowRightIcon aria-hidden />
							</Link>
						</Button>
					</CardContent>
				</Card>
			) : null}
			<Card>
				<CardHeader>
					<CardTitle>{m.intl_preview_title()}</CardTitle>
					<CardDescription>{m.intl_preview_description()}</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
						{rows.map((row) => (
							<div key={row.label} className="contents">
								<dt className="text-muted-foreground">{row.label}</dt>
								<dd data-testid="intl-value">{row.value}</dd>
							</div>
						))}
					</dl>
				</CardContent>
			</Card>
		</main>
	);
}
