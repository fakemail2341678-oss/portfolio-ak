import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { NewButton } from "@/components/crud/new-button";
import { onRows, useCrudMutation } from "@/components/crud/use-crud-mutation";
import type { RowAction } from "@/components/data-table";
import { useListPage } from "@/hooks/use-list-page";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../../links";
import { ALL_TASKLINE_ADMIN, adminProjectKeys } from "../keys";
import { adminProjectListQueryOptions, memberOptionsQueryOptions, tasklineAdminMutations } from "../queries";
import type { AdminProjectItem } from "../schema";
import { TL_ADMIN_PROJECTS_TABLE_ID } from "../search";
import { adminProjectColumns } from "./columns";
import { AdminProjectFilterControls, adminProjectFilters } from "./filters";

const route = getRouteApi("/_admin/admin/taskline/projects/");

function NewProjectButton() {
	return (
		<NewButton to="/admin/taskline/projects/new" permission="taskline:manage">
			{m.taskline_project_new()}
		</NewButton>
	);
}

/**
 * /admin/taskline/projects: every team project, private ones included, whoever leads
 * it. Archiving shows at once (and rolls back if refused); a project opens in the admin
 * (its details, members, workflow and labels) or in Taskline.
 */
export function AdminProjectList() {
	const search = route.useSearch();
	const list = useListPage({ tableId: TL_ADMIN_PROJECTS_TABLE_ID, search, query: adminProjectListQueryOptions });
	const { data: members } = useSuspenseQuery(memberOptionsQueryOptions());
	const archive = useCrudMutation(tasklineAdminMutations.setProjectArchived(), {
		invalidate: ALL_TASKLINE_ADMIN,
		optimistic: {
			queryKey: adminProjectKeys.lists(),
			update: onRows((rows: AdminProjectItem[], input: { id: string; archived: boolean }) =>
				rows.map((row) =>
					row.id === input.id
						? { ...row, archived: input.archived, status: input.archived ? ("archived" as const) : ("active" as const) }
						: row,
				),
			),
		},
	});

	const rowActions = (row: AdminProjectItem): RowAction[] => [
		{
			id: "open",
			label: m.taskline_admin_open_in_app(),
			render: (label) => <Link {...tasklineLinks.project(row.ws, row.key)}>{label}</Link>,
		},
		{
			id: "archive",
			label: row.archived ? m.taskline_admin_unarchive() : m.taskline_admin_archive(),
			permission: "taskline:manage",
			onSelect: () =>
				archive.mutate(
					{ id: row.id, archived: !row.archived },
					{
						onSuccess: () =>
							toast.success(row.archived ? m.taskline_admin_toast_unarchived() : m.taskline_admin_toast_archived()),
					},
				),
		},
	];

	return (
		<CrudListPage
			title={m.taskline_admin_projects_title()}
			description={m.taskline_admin_projects_description()}
			actions={<NewProjectButton />}
			tableId={TL_ADMIN_PROJECTS_TABLE_ID}
			list={list}
			columns={adminProjectColumns}
			getRowLabel={(row) => `${row.key} ${row.name}`}
			search={search}
			filters={{
				controls: <AdminProjectFilterControls search={search} members={members} />,
				...adminProjectFilters.applied(search, members),
			}}
			rowActions={rowActions}
			empty={{
				description: m.taskline_admin_projects_empty(),
				filtered: m.taskline_admin_projects_empty_filtered(),
				action: <NewProjectButton />,
			}}
			exportName="taskline-projects"
			savedViews
			data-testid="taskline-admin-projects"
		/>
	);
}
