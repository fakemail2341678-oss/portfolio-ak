import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { errorMessage } from "@/components/errors/error-page";
import { FilterBar } from "@/components/filters/filter-bar";
import { SearchFilter } from "@/components/filters/filters";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { exampleKeys, exampleTasksQueryOptions } from "@/features/dev/examples/queries";
import { EXAMPLE_SEARCH_DEFAULTS, type ExampleTask, exampleTaskSearchSchema } from "@/features/dev/examples/schema";
import { deleteExampleTasks } from "@/functions/examples";
import { useListQuery } from "@/hooks/use-list-query";
import { staticCrumb } from "@/lib/breadcrumbs";
import { formatDate } from "@/lib/i18n/intl";
import { loadList } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * Recipes for lists (docs/guides/recipes.md): CSV export of what the table
 * shows, delete with an undo toast, and saved views (named search strings).
 *
 * - CSV and saved views are DataTable toolbar features: `exportName` exports the
 *   rows on screen through the columns' `csv` values (src/lib/csv.ts);
 *   `savedViews` keeps named search strings for this table in localStorage.
 * - Undo: the row disappears at once and the delete is only sent when the
 *   toast closes without "Undo". (For undo after the request, soft delete:
 *   a `deleted_at` column, a restore function, and lists that skip deleted rows.)
 */
export const Route = createFileRoute("/dev/examples/list-extras")({
	validateSearch: exampleTaskSearchSchema,
	search: { middlewares: [stripSearchParams(EXAMPLE_SEARCH_DEFAULTS)] },
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, cause }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { exampleTasksQueryOptions } = await import("@/features/dev/examples/queries");
		return loadList(context.queryClient, exampleTasksQueryOptions(deps), cause);
	},
	staticData: { breadcrumb: staticCrumb(m.examples_extras_title) },
	head: () => privateHead(m.examples_extras_title()),
	component: ListExtrasExample,
});

const UNDO_MS = 5000;

const columns = (): DataTableColumn<ExampleTask>[] => [
	{
		id: "title",
		header: m.examples_task,
		cell: (task) => task.title,
		csv: (task) => task.title,
		cellClassName: "font-medium",
	},
	{
		id: "status",
		header: m.examples_status,
		cell: (task) => (task.done ? m.examples_done() : m.examples_open()),
		csv: (task) => (task.done ? m.examples_done() : m.examples_open()),
	},
	{
		id: "created",
		header: m.examples_created,
		hideable: true,
		cell: (task) => formatDate(task.createdAt, { dateStyle: "medium" }),
		csv: (task) => task.createdAt,
	},
];

function ListExtrasExample() {
	const search = Route.useSearch();
	const { data } = useListQuery(exampleTasksQueryOptions(search));
	const queryClient = useQueryClient();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
	const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
	useEffect(() => {
		const pending = timers.current;
		return () => {
			for (const timer of pending.values()) clearTimeout(timer);
		};
	}, []);

	const remove = useMutation({
		mutationFn: (id: string) => deleteExampleTasks({ data: { ids: [id] } }),
		onSettled: () => queryClient.invalidateQueries({ queryKey: exampleKeys.tasks() }),
		onError: (error) => toast.error(m.examples_failed(), { description: errorMessage(error) }),
	});

	const show = (id: string, visible: boolean) =>
		setHidden((current) => {
			const next = new Set(current);
			if (visible) next.delete(id);
			else next.add(id);
			return next;
		});

	const deleteWithUndo = (task: ExampleTask) => {
		show(task.id, false);
		timers.current.set(
			task.id,
			setTimeout(() => {
				timers.current.delete(task.id);
				remove.mutate(task.id);
			}, UNDO_MS),
		);
		toast(m.examples_extras_deleted({ title: task.title }), {
			duration: UNDO_MS,
			action: {
				label: m.examples_extras_undo(),
				onClick: () => {
					clearTimeout(timers.current.get(task.id));
					timers.current.delete(task.id);
					show(task.id, true);
				},
			},
		});
	};

	const rows = (data?.items ?? []).filter((task) => !hidden.has(task.id));

	return (
		<ExamplePage slug="list-extras">
			<Demo title={m.examples_extras_table()} note={m.examples_extras_table_note()}>
				<DataTable
					tableId="examples-extras"
					rows={rows}
					columns={columns()}
					getRowId={(task) => task.id}
					getRowLabel={(task) => task.title}
					toolbar={
						<FilterBar values={search} preserve={["sort"]}>
							<SearchFilter
								label={m.examples_search()}
								value={search.q}
								placeholder={m.examples_search_placeholder()}
							/>
						</FilterBar>
					}
					exportName="tasks"
					savedViews
					rowActions={(task) => [
						{
							id: "delete",
							label: m.examples_extras_delete(),
							destructive: true,
							onSelect: () => deleteWithUndo(task),
						},
					]}
				/>
			</Demo>
		</ExamplePage>
	);
}
