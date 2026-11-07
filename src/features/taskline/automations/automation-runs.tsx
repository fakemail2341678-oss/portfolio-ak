import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { RelativeTime } from "@/components/data-display/relative-time";
import { StatusBadge } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import type { AutomationRun } from "../types";
import { OUTCOME_TONES } from "./automations-editor";
import { OUTCOME_LABELS, runDetailText } from "./describe";

/**
 * The run log (Task 56): each time a rule's trigger fired on a task, newest first, with
 * what came of it (changed things, didn't match, nothing to change, or why it failed),
 * the task it ran on (a link while it exists) and when.
 */
export function AutomationRuns({
	runs,
	ws,
	now,
	heading: Heading = "h3",
}: {
	runs: ReadonlyArray<AutomationRun>;
	/** The workspace the tasks are in (their links). */
	ws: string;
	now: number;
	heading?: "h2" | "h3";
}) {
	const id = useId();
	return (
		<section aria-labelledby={id} className="flex flex-col gap-3" data-testid="automation-runs">
			<Heading id={id} className="font-medium text-body">
				{m.taskline_automation_runs()}
			</Heading>
			{runs.length === 0 ? (
				<p className="text-muted-foreground text-sm">{m.taskline_automation_runs_empty()}</p>
			) : (
				<ol className="flex flex-col divide-y rounded-md border">
					{runs.map((run) => (
						<li
							key={run.id}
							className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2"
							data-testid="automation-run"
						>
							<StatusBadge tone={OUTCOME_TONES[run.outcome]}>{OUTCOME_LABELS[run.outcome]()}</StatusBadge>
							<span className="min-w-0 flex-1">
								<span className="font-medium">{run.automation}</span>
								<span className="text-muted-foreground"> · </span>
								{run.ref ? (
									<Link {...tasklineLinks.task(ws, run.ref)} className="underline-offset-4 hover:underline">
										<span className="font-mono text-caption">{run.ref}</span> {run.title}
									</Link>
								) : (
									<span className="text-muted-foreground">{m.taskline_automation_run_no_task()}</span>
								)}
								<span className="block text-caption text-muted-foreground">{runDetailText(run)}</span>
							</span>
							<RelativeTime value={run.at} now={now} className="text-caption text-muted-foreground" />
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
