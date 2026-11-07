import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ExternalLinkIcon, UserPlusIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { useConfirm } from "@/components/dialogs/confirm";
import { FormSection } from "@/components/page/form-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useCan } from "@/features/rbac/can";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { TASKLINE_COLOR_LABELS, tasklineColor } from "../../colors";
import { CATEGORY_LABELS, PROJECT_ROLE_LABELS } from "../../labels";
import { tasklineLinks } from "../../links";
import { PROJECT_ROLES, type ProjectRole, type TasklineColor } from "../../types";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { adminProjectQueryOptions, memberOptionsQueryOptions, tasklineAdminMutations } from "../queries";
import type { AdminProjectDetail, AdminProjectMember } from "../schema";

/** The project page's other tabs: who is on it (the admin changes it), its workflow and labels (edited in Taskline). */

const membersRoute = getRouteApi("/_admin/admin/taskline/projects/$id/members");
const workflowRoute = getRouteApi("/_admin/admin/taskline/projects/$id/workflow");
const labelsRoute = getRouteApi("/_admin/admin/taskline/projects/$id/labels");

function Swatch({ color }: { color: TasklineColor }) {
	return (
		<span className="flex items-center gap-2">
			<span className="size-2.5 shrink-0 rounded-full" style={{ background: tasklineColor(color) }} aria-hidden />
			{TASKLINE_COLOR_LABELS[color]()}
		</span>
	);
}

export function AdminProjectMembers() {
	const { id } = membersRoute.useParams();
	const { data: project } = useSuspenseQuery(adminProjectQueryOptions(id));
	const { data: members } = useSuspenseQuery(memberOptionsQueryOptions());
	const canManage = useCan("taskline:manage");
	const confirm = useConfirm();
	const formId = useId();
	const [adding, setAdding] = useState({ memberId: "", role: "member" as ProjectRole });
	const set = useCrudMutation(tasklineAdminMutations.setProjectMember(), { invalidate: ALL_TASKLINE_ADMIN });
	const remove = useCrudMutation(tasklineAdminMutations.removeProjectMember(), { invalidate: ALL_TASKLINE_ADMIN });
	const onProject = new Set(project.projectMembers.map((member) => member.memberId));
	const candidates = members.filter((member) => !onProject.has(member.id));

	const columns: ReadonlyArray<DataTableColumn<AdminProjectMember>> = [
		{
			id: "name",
			header: m.taskline_admin_col_member,
			cell: (row) => (
				<div className="flex min-w-0 flex-col">
					<span className="truncate font-medium">{row.name}</span>
					{row.email ? <span className="truncate text-muted-foreground text-xs">{row.email}</span> : null}
				</div>
			),
		},
		{
			id: "role",
			header: m.taskline_admin_col_role,
			cell: (row) =>
				canManage && !project.archived ? (
					<NativeSelect
						aria-label={m.taskline_admin_role_of({ name: row.name })}
						value={row.role}
						onChange={(event) =>
							set.mutate(
								{ id, memberId: row.memberId, role: event.target.value as ProjectRole },
								{ onSuccess: () => toast.success(m.crud_toast_saved()) },
							)
						}
					>
						{PROJECT_ROLES.map((role) => (
							<option key={role} value={role}>
								{PROJECT_ROLE_LABELS[role]()}
							</option>
						))}
					</NativeSelect>
				) : (
					PROJECT_ROLE_LABELS[row.role]()
				),
		},
	];

	return (
		<div className="flex flex-col gap-6" data-testid="project-members">
			{canManage && !project.archived ? (
				<form
					method="post"
					className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!adding.memberId) return;
						set.mutate(
							{ id, ...adding },
							{
								onSuccess: () => {
									toast.success(m.taskline_admin_toast_member_added());
									setAdding({ memberId: "", role: "member" });
								},
							},
						);
					}}
				>
					<div className="flex min-w-56 flex-col gap-2">
						<Label htmlFor={`${formId}-member`}>{m.taskline_admin_col_member()}</Label>
						<NativeSelect
							id={`${formId}-member`}
							value={adding.memberId}
							onChange={(event) => setAdding({ ...adding, memberId: event.target.value })}
							data-testid="project-member-pick"
						>
							<option value="">{m.taskline_admin_pick_member()}</option>
							{candidates.map((member) => (
								<option key={member.id} value={member.id}>
									{member.name}
								</option>
							))}
						</NativeSelect>
					</div>
					<div className="flex min-w-40 flex-col gap-2">
						<Label htmlFor={`${formId}-role`}>{m.taskline_admin_col_role()}</Label>
						<NativeSelect
							id={`${formId}-role`}
							value={adding.role}
							onChange={(event) => setAdding({ ...adding, role: event.target.value as ProjectRole })}
						>
							{PROJECT_ROLES.map((role) => (
								<option key={role} value={role}>
									{PROJECT_ROLE_LABELS[role]()}
								</option>
							))}
						</NativeSelect>
					</div>
					<Button type="submit" disabled={!adding.memberId || set.isPending} data-testid="project-member-add">
						<UserPlusIcon aria-hidden />
						{m.taskline_admin_add_to_project()}
					</Button>
				</form>
			) : null}
			<DataTable
				tableId="admin-taskline-project-members"
				rows={project.projectMembers}
				columns={columns}
				getRowId={(row) => row.memberId}
				getRowLabel={(row) => row.name}
				rowActions={(row) => [
					{
						id: "remove",
						label: m.taskline_admin_remove_from_project(),
						permission: "taskline:manage",
						destructive: true,
						hidden: project.archived,
						onSelect: async () => {
							const confirmed = await confirm({
								title: m.taskline_admin_remove_title({ name: row.name }),
								description: m.taskline_admin_remove_body(),
								confirmLabel: m.taskline_admin_remove_from_project(),
								destructive: true,
							});
							if (confirmed) remove.mutate({ id, memberId: row.memberId });
						},
					},
				]}
				empty={<p className="p-6 text-center text-muted-foreground">{m.taskline_admin_project_members_empty()}</p>}
			/>
		</div>
	);
}

function EditInTaskline({ project, section }: { project: AdminProjectDetail; section: "workflow" | "labels" }) {
	return (
		<Button variant="outline" asChild>
			<Link {...tasklineLinks.settings(project.ws, project.key, section)}>
				<ExternalLinkIcon aria-hidden />
				{m.taskline_admin_edit_in_app()}
			</Link>
		</Button>
	);
}

export function AdminProjectWorkflow() {
	const { id } = workflowRoute.useParams();
	const { data: project } = useSuspenseQuery(adminProjectQueryOptions(id));
	const columns: ReadonlyArray<DataTableColumn<AdminProjectDetail["statuses"][number]>> = [
		{ id: "name", header: m.taskline_admin_col_status, cell: (row) => <span className="font-medium">{row.name}</span> },
		{ id: "category", header: m.taskline_status_category, cell: (row) => CATEGORY_LABELS[row.category]() },
		{ id: "color", header: m.taskline_project_color, cell: (row) => <Swatch color={row.color} /> },
		{
			id: "wip",
			header: m.taskline_admin_col_wip,
			cellClassName: "text-end tabular-nums",
			cell: (row) => (row.wipLimit ? formatNumber(row.wipLimit) : "—"),
		},
		{
			id: "tasks",
			header: m.taskline_admin_count_tasks,
			cellClassName: "text-end tabular-nums",
			cell: (row) => formatNumber(row.tasks),
		},
	];
	return (
		<FormSection title={m.taskline_admin_tab_workflow()} description={m.taskline_admin_workflow_hint()}>
			<div>
				<EditInTaskline project={project} section="workflow" />
			</div>
			<DataTable
				tableId="admin-taskline-project-statuses"
				scrollRegion
				rows={project.statuses}
				columns={columns}
				getRowId={(row) => row.id}
				getRowLabel={(row) => row.name}
			/>
		</FormSection>
	);
}

export function AdminProjectLabels() {
	const { id } = labelsRoute.useParams();
	const { data: project } = useSuspenseQuery(adminProjectQueryOptions(id));
	const columns: ReadonlyArray<DataTableColumn<AdminProjectDetail["labels"][number]>> = [
		{ id: "name", header: m.taskline_admin_col_label, cell: (row) => <span className="font-medium">{row.name}</span> },
		{ id: "color", header: m.taskline_project_color, cell: (row) => <Swatch color={row.color} /> },
		{
			id: "tasks",
			header: m.taskline_admin_count_tasks,
			cellClassName: "text-end tabular-nums",
			cell: (row) => formatNumber(row.tasks),
		},
	];
	return (
		<FormSection title={m.taskline_admin_tab_labels()} description={m.taskline_admin_labels_hint()}>
			<div>
				<EditInTaskline project={project} section="labels" />
			</div>
			<DataTable
				tableId="admin-taskline-project-labels"
				scrollRegion
				rows={project.labels}
				columns={columns}
				getRowId={(row) => row.id}
				getRowLabel={(row) => row.name}
				empty={<p className="p-6 text-center text-muted-foreground">{m.taskline_admin_labels_empty()}</p>}
			/>
		</FormSection>
	);
}
