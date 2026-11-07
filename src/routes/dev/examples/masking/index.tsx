import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useCloseOverlay } from "@/components/navigation/use-close-overlay";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { PRIORITY_LABELS } from "@/features/dev/examples/labels";
import { exampleTaskQueryOptions, exampleTasksQueryOptions } from "@/features/dev/examples/queries";
import { EXAMPLE_SEARCH_DEFAULTS, type ExampleTaskSearch } from "@/features/dev/examples/schema";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

const LIST: ExampleTaskSearch = { ...EXAMPLE_SEARCH_DEFAULTS, done: undefined };

/**
 * Route masking: each link's real location is this list with `?open=<id>` (the
 * dialog below), but the address bar and the href show the task's own URL
 * (/dev/examples/masking/<id>). `unmaskOnReload: true` is required with SSR: a
 * reload asks the server for the shown URL, so the browser must render that page
 * too. Closing goes back in history (useCloseOverlay).
 */
export const Route = createFileRoute("/dev/examples/masking/")({
	validateSearch: z.object({ open: z.uuid().optional().catch(undefined) }),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { exampleTasksQueryOptions } = await import("@/features/dev/examples/queries");
		await ensureQuery(context.queryClient, exampleTasksQueryOptions(LIST));
	},
	head: () => privateHead(m.examples_masking_title()),
	component: MaskingExample,
});

function MaskingExample() {
	const { open } = Route.useSearch();
	const { data } = useSuspenseQuery(exampleTasksQueryOptions(LIST));
	return (
		<ExamplePage slug="masking">
			<Demo title={m.examples_masking_demo()} note={m.examples_masking_note()}>
				<ul className="divide-y rounded-md border" data-testid="masking-list">
					{data.items.map((task) => (
						<li key={task.id}>
							<Link
								from="/dev/examples/masking/"
								to="."
								search={{ open: task.id }}
								mask={{ to: "/dev/examples/masking/$id", params: { id: task.id }, unmaskOnReload: true }}
								className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
							>
								{task.title}
								<Badge variant="secondary">{PRIORITY_LABELS[task.priority]()}</Badge>
							</Link>
						</li>
					))}
				</ul>
			</Demo>
			{open ? <TaskDialog id={open} /> : null}
		</ExamplePage>
	);
}

const CLOSE = { open: undefined };

function TaskDialog({ id }: { id: string }) {
	const close = useCloseOverlay(CLOSE);
	const { data: task } = useQuery(exampleTaskQueryOptions(id));
	return (
		<Dialog open onOpenChange={(isOpen) => !isOpen && close()}>
			<DialogContent data-testid="masking-dialog">
				<DialogHeader>
					<DialogTitle>{task?.title ?? m.examples_working()}</DialogTitle>
					<DialogDescription>{m.examples_masking_dialog_note()}</DialogDescription>
				</DialogHeader>
				{task ? (
					<div className="flex flex-wrap items-center gap-2 text-sm">
						<Badge variant="secondary">{PRIORITY_LABELS[task.priority]()}</Badge>
						<span>{task.done ? m.examples_done() : m.examples_open()}</span>
						<Link to="/dev/examples/masking/$id" params={{ id }} className="ms-auto underline underline-offset-4">
							{m.examples_masking_open_page()}
						</Link>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
