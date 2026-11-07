import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowDownUpIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { NewButton } from "@/components/crud/new-button";
import { patchRow, useCrudMutation, withoutRows } from "@/components/crud/use-crud-mutation";
import type { RowAction } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/rbac/can";
import { useListPage } from "@/hooks/use-list-page";
import { m } from "@/paraglide/messages";
import { type PortfolioStatus, PROJECTS_TABLE_ID, type ProjectListItem } from "../../schema";
import { projectColumns } from "../columns";
import { ProjectFilterControls, projectFilters } from "../filters";
import { projectKeys } from "../keys";
import { projectListQueryOptions, projectMutations } from "../queries";
import { PreviewLink } from "./shared";

// Opens on click: its dnd-kit list loads with it, not with the page (0168).
const ReorderProjectsDialog = lazy(() =>
	import("./project-reorder-dialog").then((module) => ({ default: module.ReorderProjectsDialog })),
);

const route = getRouteApi("/_admin/admin/portfolio/projects/");

/** "New project", for users who may write. */
export function NewProjectButton() {
	return (
		<NewButton to="/admin/portfolio/projects/new" permission="portfolio:write">
			{m.portfolio_admin_projects_new()}
		</NewButton>
	);
}

/**
 * /admin/portfolio/projects (docs/guides/crud.md): publish and delete show at
 * once on every cached page; "Reorder" sets the order the public pages use.
 */
export function ProjectList() {
	const search = route.useSearch();
	const list = useListPage({ tableId: PROJECTS_TABLE_ID, search, query: projectListQueryOptions });
	const canWrite = useCan("portfolio:write");
	const [reordering, setReordering] = useState(false);

	const remove = useCrudMutation(projectMutations.delete(), {
		invalidate: [projectKeys.all],
		optimistic: { queryKey: projectKeys.lists(), update: withoutRows<ProjectListItem> },
	});
	const setStatus = useCrudMutation(projectMutations.setStatus(), {
		invalidate: [projectKeys.all],
		optimistic: {
			queryKey: projectKeys.lists(),
			update: patchRow((row: ProjectListItem, { status }: { id: string; status: PortfolioStatus }) => ({
				...row,
				status,
			})),
		},
	});
	const publish = (row: ProjectListItem) => {
		const status = row.status === "published" ? "draft" : "published";
		setStatus.mutate(
			{ id: row.id, status },
			{
				onSuccess: () =>
					toast.success(
						status === "published" ? m.portfolio_admin_toast_published() : m.portfolio_admin_toast_unpublished(),
					),
			},
		);
	};

	const rowActions = (row: ProjectListItem): RowAction[] => [
		{
			id: "edit",
			label: m.crud_edit(),
			permission: "portfolio:write",
			render: (label) => (
				<Link to="/admin/portfolio/projects/$id" params={{ id: row.id }}>
					{label}
				</Link>
			),
		},
		{
			id: "preview",
			label: m.portfolio_admin_preview(),
			render: (label) => (
				<PreviewLink kind="work" slug={row.slug}>
					{label}
				</PreviewLink>
			),
		},
		{
			id: "publish",
			label: row.status === "published" ? m.portfolio_admin_unpublish() : m.portfolio_admin_publish(),
			permission: "portfolio:publish",
			onSelect: () => publish(row),
		},
	];

	const actions = (
		<>
			{canWrite ? (
				<Button variant="outline" onClick={() => setReordering(true)}>
					<ArrowDownUpIcon aria-hidden />
					{m.portfolio_admin_reorder()}
				</Button>
			) : null}
			<NewProjectButton />
		</>
	);

	return (
		<CrudListPage
			title={m.portfolio_admin_projects_title()}
			description={m.portfolio_admin_projects_description()}
			actions={actions}
			tableId={PROJECTS_TABLE_ID}
			list={list}
			columns={projectColumns}
			getRowLabel={(row) => row.title}
			search={search}
			filters={{ controls: <ProjectFilterControls search={search} />, ...projectFilters.applied(search) }}
			rowActions={rowActions}
			remove={{ permission: "portfolio:write", run: (ids) => remove.mutateAsync(ids) }}
			empty={{
				description: m.portfolio_admin_projects_empty(),
				filtered: m.portfolio_admin_empty_filtered(),
				action: <NewProjectButton />,
			}}
			exportName="projects"
			data-testid="projects-table"
		>
			{reordering ? (
				<Suspense fallback={null}>
					<ReorderProjectsDialog onClose={() => setReordering(false)} />
				</Suspense>
			) : null}
		</CrudListPage>
	);
}
