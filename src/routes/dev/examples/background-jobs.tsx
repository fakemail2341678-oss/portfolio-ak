import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { runExampleJobFn } from "@/functions/examples";
import { staticCrumb } from "@/lib/breadcrumbs";
import { formatNumber } from "@/lib/i18n/intl";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * Recipe: background jobs (docs/guides/recipes.md). A job is named steps, each
 * retried with backoff; a finished step never runs again. This runs in the
 * request to show the semantics (src/server/examples/jobs.ts). In an app, the
 * request only enqueues (Workflow DevKit, Inngest or Trigger.dev) and returns,
 * and the service runs the steps durably.
 */
export const Route = createFileRoute("/dev/examples/background-jobs")({
	staticData: { breadcrumb: staticCrumb(m.examples_jobs_title) },
	head: () => privateHead(m.examples_jobs_title()),
	component: BackgroundJobsExample,
});

function BackgroundJobsExample() {
	const [failures, setFailures] = useState(2);
	const run = useMutation({ mutationFn: (count: number) => runExampleJobFn({ data: { failures: count } }) });
	return (
		<ExamplePage slug="background-jobs">
			<Demo title={m.examples_jobs_title()} note={m.examples_jobs_note()}>
				<div className="flex flex-wrap items-center gap-2">
					{[0, 2, 4].map((count) => (
						<Button
							key={count}
							variant={failures === count ? "default" : "outline"}
							size="sm"
							aria-pressed={failures === count}
							onClick={() => setFailures(count)}
						>
							{m.examples_jobs_failures({ count: formatNumber(count) })}
						</Button>
					))}
					<Button onClick={() => run.mutate(failures)} disabled={run.isPending}>
						{run.isPending ? m.examples_working() : m.examples_jobs_run()}
					</Button>
				</div>
				{run.data ? (
					<div className="flex flex-col gap-2" data-testid="job-log">
						<p className="font-medium text-sm">{run.data.ok ? m.examples_jobs_ok() : m.examples_jobs_gave_up()}</p>
						<ol className="flex flex-col gap-1 font-mono text-xs">
							{run.data.log.map((entry) => (
								<li key={`${entry.step}-${entry.attempt}`}>
									{entry.step} #{entry.attempt} {entry.outcome === "ok" ? "✓" : "✗"}
									{entry.delayMs ? ` (+${entry.delayMs} ms)` : ""}
								</li>
							))}
						</ol>
					</div>
				) : null}
			</Demo>
		</ExamplePage>
	);
}
