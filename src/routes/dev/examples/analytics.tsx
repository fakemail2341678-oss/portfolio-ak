import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DescriptionList } from "@/components/data-display/description-list";
import { Button } from "@/components/ui/button";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { homeFlagsQueryOptions } from "@/features/flags/queries";
import { staticCrumb } from "@/lib/breadcrumbs";
import { analyticsKey, analyticsRunning, track } from "@/lib/observability/analytics";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { usePreferences, usePreferencesStore } from "@/lib/stores/hooks";
import type { AnalyticsConsent } from "@/lib/stores/preferences";
import { m } from "@/paraglide/messages";

/**
 * Analytics consent and feature flags:
 * - consent is a preference cookie ("unset" shows the banner); PostHog is
 *   downloaded and started only after "granted" (ObservabilitySync);
 * - track() is a no-op until then, so features call it freely;
 * - flags are evaluated on the SERVER in the loader and SSR'd through the Query
 *   cache: no flicker and no flag request from the browser. Unknown or
 *   unconfigured flags are off.
 */
export const Route = createFileRoute("/dev/examples/analytics")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { homeFlagsQueryOptions } = await import("@/features/flags/queries");
		await ensureQuery(context.queryClient, homeFlagsQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.examples_analytics_title) },
	head: () => privateHead(m.examples_analytics_title()),
	component: AnalyticsExample,
});

const CONSENT_LABELS: Record<AnalyticsConsent, () => string> = {
	unset: m.examples_analytics_consent_unset,
	granted: m.examples_analytics_consent_granted,
	denied: m.examples_analytics_consent_denied,
};

function AnalyticsExample() {
	const { data: flags } = useSuspenseQuery(homeFlagsQueryOptions());
	const consent = usePreferences((preferences) => preferences.analyticsConsent);
	const store = usePreferencesStore();
	const [result, setResult] = useState<string | null>(null);

	const sendEvent = () => {
		track("examples_event", { source: "dev-examples" });
		setResult(analyticsRunning() ? m.examples_analytics_sent() : m.examples_analytics_dropped());
	};

	return (
		<ExamplePage slug="analytics">
			<Demo title={m.examples_analytics_consent()} note={m.examples_analytics_consent_note()}>
				<DescriptionList
					items={[
						{
							label: m.examples_analytics_configured(),
							value: analyticsKey ? m.examples_yes() : m.examples_no(),
						},
						{ label: m.examples_analytics_consent(), value: CONSENT_LABELS[consent](), testId: "consent-value" },
					]}
				/>
				<div className="flex flex-wrap gap-2">
					<Button size="sm" variant="outline" onClick={() => store.actions.setAnalyticsConsent("granted")}>
						{m.consent_accept()}
					</Button>
					<Button size="sm" variant="outline" onClick={() => store.actions.setAnalyticsConsent("denied")}>
						{m.consent_decline()}
					</Button>
					<Button size="sm" variant="ghost" onClick={() => store.actions.setAnalyticsConsent("unset")}>
						{m.examples_analytics_ask_again()}
					</Button>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Button size="sm" onClick={sendEvent}>
						{m.examples_analytics_send()}
					</Button>
					<output className="text-sm" data-testid="track-result">
						{result}
					</output>
				</div>
			</Demo>
			<Demo title={m.examples_analytics_flags()} note={m.examples_analytics_flags_note()}>
				<DescriptionList
					items={[
						{
							label: "home-items-cta",
							value: flags.showItemsCta ? m.examples_on() : m.examples_off(),
							testId: "flag-value",
						},
					]}
				/>
			</Demo>
		</ExamplePage>
	);
}
