import { useDebouncedValue } from "@tanstack/react-pacer";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";
import { DescriptionList } from "@/components/data-display/description-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Demo, ExamplePage } from "@/features/dev/examples/components/example-page";
import { usePacedRefresh } from "@/hooks/use-paced-refresh";
import { staticCrumb } from "@/lib/breadcrumbs";
import { formatNumber } from "@/lib/i18n/intl";
import { createJobQueue } from "@/lib/job-queue";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * TanStack Pacer (decision 0299) is the one way to debounce, throttle and queue:
 * - `useDebouncedValue(value, { wait })` for a search that waits for a pause in typing (the
 *   filter bar, the async combobox and the palettes use it; a form's own `asyncDebounceMs` stays);
 * - `usePacedRefresh(refresh)` (src/hooks/use-paced-refresh.ts, a throttle) for a reload that a
 *   poll, a moved `rev` or realtime events ask for: a burst reloads at once and once at its end;
 * - `createJobQueue(concurrency)` (src/lib/job-queue.ts) for work that must not all start at
 *   once: uploads go three at a time, and Chaal's Lichess lanes are queues of one.
 * The defaults are `PacingProvider`'s (src/components/layout/pacing-provider.tsx). Any other
 * `setTimeout` says why it is not one of these in a `// timer: <reason>` comment.
 */
export const Route = createFileRoute("/dev/examples/pacing")({
	staticData: { breadcrumb: staticCrumb(m.examples_pacing_title) },
	head: () => privateHead(m.examples_pacing_title()),
	component: PacingExample,
});

const JOBS = 6;
// Two at a time, for every visitor of this page in the tab.
const queued = createJobQueue(2);
// timer: pretends a job that takes a while, so the queue has something to hold back.
const work = () => new Promise<void>((resolve) => setTimeout(resolve, 600));

function PacingExample() {
	return (
		<ExamplePage slug="pacing">
			<DebounceDemo />
			<ThrottleDemo />
			<QueueDemo />
		</ExamplePage>
	);
}

function DebounceDemo() {
	const id = useId();
	const [typed, setTyped] = useState("");
	const [searched] = useDebouncedValue(typed, { wait: 400 });
	return (
		<Demo title={m.examples_pacing_debounce()} note={m.examples_pacing_debounce_note()}>
			<div className="flex flex-col gap-2">
				<Label htmlFor={id}>{m.examples_pacing_debounce_label()}</Label>
				<Input id={id} value={typed} onChange={(event) => setTyped(event.target.value)} className="max-w-sm" />
			</div>
			<DescriptionList
				items={[
					{ label: m.examples_pacing_typed(), value: typed || m.examples_none() },
					{ label: m.examples_pacing_searched(), value: searched || m.examples_none(), testId: "pacing-searched" },
				]}
			/>
		</Demo>
	);
}

function ThrottleDemo() {
	const [events, setEvents] = useState(0);
	const [reloads, setReloads] = useState(0);
	const refresh = usePacedRefresh(() => setReloads((count) => count + 1));
	const send = () => {
		setEvents((count) => count + 10);
		for (let index = 0; index < 10; index++) refresh();
	};
	return (
		<Demo title={m.examples_pacing_throttle()} note={m.examples_pacing_throttle_note()}>
			<div>
				<Button type="button" variant="outline" onClick={send}>
					{m.examples_pacing_send()}
				</Button>
			</div>
			<DescriptionList
				items={[
					{ label: m.examples_pacing_events(), value: formatNumber(events) },
					{ label: m.examples_pacing_reloads(), value: formatNumber(reloads), testId: "pacing-reloads" },
				]}
			/>
		</Demo>
	);
}

function QueueDemo() {
	const [jobs, setJobs] = useState({ waiting: 0, running: 0, done: 0 });
	const add = () => {
		setJobs((now) => ({ ...now, waiting: now.waiting + JOBS }));
		for (let index = 0; index < JOBS; index++) {
			void queued(async () => {
				setJobs((now) => ({ ...now, waiting: now.waiting - 1, running: now.running + 1 }));
				await work();
				setJobs((now) => ({ ...now, running: now.running - 1, done: now.done + 1 }));
			});
		}
	};
	return (
		<Demo title={m.examples_pacing_queue()} note={m.examples_pacing_queue_note()}>
			<div>
				<Button type="button" variant="outline" onClick={add}>
					{m.examples_pacing_add()}
				</Button>
			</div>
			<DescriptionList
				items={[
					{ label: m.examples_pacing_waiting(), value: formatNumber(jobs.waiting) },
					{ label: m.examples_pacing_running(), value: formatNumber(jobs.running), testId: "pacing-running" },
					{ label: m.examples_pacing_done(), value: formatNumber(jobs.done), testId: "pacing-done" },
				]}
			/>
		</Demo>
	);
}
