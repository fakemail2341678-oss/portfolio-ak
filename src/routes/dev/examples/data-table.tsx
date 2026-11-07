import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { StatusBadge } from "@/components/data-display/status-badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Pagination } from "@/components/navigation/pagination";
import { EmptyState } from "@/components/page/empty-state";
import { Button } from "@/components/ui/button";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { PRIORITY_LABELS } from "@/features/dev/examples/labels";
import { exampleKeys, exampleTasksQueryOptions } from "@/features/dev/examples/queries";
import { EXAMPLE_SEARCH_DEFAULTS, type ExampleTask, exampleTaskSearchSchema } from "@/features/dev/examples/schema";
import { deleteExampleTasks, resetExampleTasks, setExampleTasksDone } from "@/functions/examples";
import { useListQuery } from "@/hooks/use-list-query";
import { staticCrumb } from "@/lib/breadcrumbs";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { loadList } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * DataTable + bulk actions. The feature supplies only column definitions and
 * actions; the shared DataTable does the rest: sort links in the headers (the
 * URL's ?sort=), selection with a bulk bar, row menus (and right-click), column
 * visibility saved in preferences, CSV export and saved views in its toolbar.
 * Confirms go through useConfirm(). Writes are plain mutations that refresh the
 * list afterwards (the optimistic version is the next example).
 */
export const Route = createFileRoute("/dev/examples/data-table")({
	validateSearch: exampleTaskSearchSchema,
	search: { middlewares: [stripSearchParams(EXAMPLE_SEARCH_DEFAULTS)] },
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, cause }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { exampleTasksQueryOptions } = await import("@/features/dev/examples/queries");
		return loadList(context.queryClient, exampleTasksQueryOptions(deps), cause);
	},
	staticData: { breadcrumb: staticCrumb(m.examples_table_title) },
	head: () => privateHead(m.examples_table_title()),
	component: DataTableExample,
});

const TABLE_ID = "examples-tasks";

/** Columns: defined once per feature (normally next to its schema), at render time for the locale. */
const columns = (): DataTableColumn<ExampleTask>[] => [
	{
		id: "title",
		header: m.examples_task,
		sort: "title",
		cell: (task) => task.title,
		csv: (task) => task.title,
		cellClassName: "font-medium",
	},
	{
		id: "priority",
		header: m.examples_priority,
		hideable: true,
		cell: (task) => PRIORITY_LABELS[task.priority](),
		csv: (task) => PRIORITY_LABELS[task.priority](),
	},
	{
		id: "status",
		header: m.examples_status,
		cell: (task) => (
			<StatusBadge tone={task.done ? "success" : "neutral"}>
				{task.done ? m.examples_done() : m.examples_open()}
			</StatusBadge>
		),
		csv: (task) => (task.done ? m.examples_done() : m.examples_open()),
	},
	{
		id: "created",
		header: m.examples_created,
		sort: "created",
		hideable: true,
		cell: (task) => formatDate(task.createdAt, { dateStyle: "medium" }),
		csv: (task) => task.createdAt,
		cellClassName: "whitespace-nowrap",
	},
];

function DataTableExample() {
	const search = Route.useSearch();
	const { data, busy, error } = useListQuery(exampleTasksQueryOptions(search));
	const queryClient = useQueryClient();
	const confirm = useConfirm();

	const refresh = () => queryClient.invalidateQueries({ queryKey: exampleKeys.tasks() });
	const onError = (failure: unknown) => toast.error(m.examples_failed(), { description: errorMessage(failure) });
	const setDone = useMutation({
		mutationFn: (input: { ids: string[]; done: boolean }) => setExampleTasksDone({ data: { ...input, fail: false } }),
		onSuccess: ({ updated }) => toast.success(m.examples_updated({ count: formatNumber(updated) })),
		onError,
		onSettled: refresh,
	});
	const remove = useMutation({
		mutationFn: (ids: string[]) => deleteExampleTasks({ data: { ids } }),
		onSuccess: ({ deleted }) => toast.success(m.examples_deleted({ count: formatNumber(deleted) })),
		onError,
		onSettled: refresh,
	});
	const reset = useMutation({ mutationFn: () => resetExampleTasks(), onSettled: refresh, onError });

	const askDelete = async (ids: string[], clear?: () => void) => {
		const confirmed = await confirm({
			title: m.examples_delete_title({ count: formatNumber(ids.length) }),
			description: m.examples_delete_body(),
			confirmLabel: m.examples_delete(),
			destructive: true,
		});
		if (confirmed) remove.mutate(ids, { onSuccess: clear });
	};

	if (error && !data) throw error;
	if (!data) return null;
	const tableColumns = columns();
	return (
		<ExamplePage slug="data-table">
			<Demo title={m.examples_table_demo()} note={m.examples_table_note()}>
				<DataTable
					tableId={TABLE_ID}
					rows={data.items}
					columns={tableColumns}
					getRowId={(task) => task.id}
					getRowLabel={(task) => task.title}
					sort={search.sort}
					busy={busy || setDone.isPending || remove.isPending}
					toolbar={
						<Button variant="outline" onClick={() => reset.mutate()} disabled={reset.isPending}>
							{m.examples_reset()}
						</Button>
					}
					exportName="tasks"
					savedViews
					empty={<EmptyState variant="no-matches" description={m.examples_no_results()} />}
					bulkActions={({ ids, clear }) => (
						<>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setDone.mutate({ ids, done: true }, { onSuccess: clear })}
							>
								{m.examples_mark_done()}
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setDone.mutate({ ids, done: false }, { onSuccess: clear })}
							>
								{m.examples_mark_open()}
							</Button>
							<Button size="sm" variant="destructive" onClick={() => void askDelete(ids, clear)}>
								{m.examples_delete()}
							</Button>
						</>
					)}
					rowActions={(task) => [
						{
							id: "toggle",
							label: task.done ? m.examples_mark_open() : m.examples_mark_done(),
							onSelect: () => setDone.mutate({ ids: [task.id], done: !task.done }),
						},
						{
							id: "delete",
							label: m.examples_delete(),
							destructive: true,
							separated: true,
							onSelect: () => void askDelete([task.id]),
						},
					]}
					data-testid="example-table"
				/>
				<Pagination page={data.page} pageCount={data.pageCount} total={data.total} hideWhenSingle />
			</Demo>
		</ExamplePage>
	);
}
