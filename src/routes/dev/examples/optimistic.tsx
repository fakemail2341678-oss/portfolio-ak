import { useDbClient, useLiveQuery } from "@tanstack/react-db";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { DbScope } from "@/components/layout/db-scope";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { type ExampleUpdateMetadata, exampleTasksCollection } from "@/features/dev/examples/collection";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { exampleTasksQueryOptions, OPTIMISTIC_SEARCH } from "@/features/dev/examples/queries";
import type { ExampleTask } from "@/features/dev/examples/schema";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * TanStack DB optimistic update and rollback (src/features/dev/examples/collection.ts),
 * inside <DbScope> (TanStack DB isn't on every page, decision 0189):
 * - the loader puts the rows in the Query cache (SSR); the collection uses the
 *   same query key, so they are its initial state;
 * - ticking a task changes the collection at once; the server is called in the
 *   collection's onUpdate (600 ms here);
 * - with "Make the server refuse" on, onUpdate throws: TanStack DB puts the row
 *   back and isPersisted.promise rejects (shown as a toast).
 */
export const Route = createFileRoute("/dev/examples/optimistic")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { exampleTasksQueryOptions, OPTIMISTIC_SEARCH } = await import("@/features/dev/examples/queries");
		await ensureQuery(context.queryClient, exampleTasksQueryOptions(OPTIMISTIC_SEARCH));
	},
	staticData: { breadcrumb: staticCrumb(m.examples_optimistic_title) },
	head: () => privateHead(m.examples_optimistic_title()),
	component: () => (
		<DbScope>
			<OptimisticExample />
		</DbScope>
	),
});

function OptimisticExample() {
	const { data: page } = useQuery(exampleTasksQueryOptions(OPTIMISTIC_SEARCH));
	const dbClient = useDbClient();
	const collection = useMemo(() => dbClient.collection(exampleTasksCollection), [dbClient]);
	const live = useLiveQuery({ query: (q) => q.from({ task: collection }) });
	const [fail, setFail] = useState(false);
	const failId = useId();

	// Until the collection is ready (SSR, first paint) the identical Query rows render, so hydration matches.
	const items = page?.items;
	const rows = useMemo(() => {
		if (!items) return [];
		if (!live.isReady) return items;
		return items.flatMap((task) => {
			const current = live.state.get(task.id);
			return current ? [current] : [];
		});
	}, [live.isReady, live.state, items]);

	const toggle = (task: ExampleTask, done: boolean) => {
		const metadata: ExampleUpdateMetadata = { fail };
		const tx = collection.update(task.id, { metadata }, (draft) => {
			draft.done = done;
		});
		tx.isPersisted.promise.then(
			() => toast.success(m.examples_optimistic_saved({ title: task.title })),
			(failure: unknown) =>
				toast.error(m.examples_optimistic_rolled_back({ title: task.title }), { description: errorMessage(failure) }),
		);
	};

	return (
		<ExamplePage slug="optimistic">
			<Demo title={m.examples_optimistic_demo()} note={m.examples_optimistic_note()}>
				<div className="flex items-center gap-3">
					<Switch id={failId} checked={fail} onCheckedChange={setFail} data-testid="fail-switch" />
					<Label htmlFor={failId}>{m.examples_optimistic_fail()}</Label>
				</div>
				<ul className="divide-y rounded-md border" data-testid="optimistic-list">
					{rows.map((task) => (
						<TaskRow key={task.id} task={task} onToggle={toggle} />
					))}
				</ul>
			</Demo>
		</ExamplePage>
	);
}

function TaskRow({ task, onToggle }: { task: ExampleTask; onToggle: (task: ExampleTask, done: boolean) => void }) {
	const id = useId();
	return (
		<li className="flex items-center gap-3 px-3 py-2 text-sm">
			<Checkbox id={id} checked={task.done} onCheckedChange={(checked) => onToggle(task, checked === true)} />
			<Label htmlFor={id} className={task.done ? "font-normal text-muted-foreground line-through" : "font-normal"}>
				{task.title}
			</Label>
		</li>
	);
}
