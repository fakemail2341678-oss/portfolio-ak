import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, Outlet } from "@tanstack/react-router";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	DownloadIcon,
	ExternalLinkIcon,
	FileTextIcon,
	LayoutTemplateIcon,
	ListChecksIcon,
	TagIcon,
	Trash2Icon,
	UsersIcon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusOf } from "@/components/data-display/status-badge";
import { Page, PageHeader } from "@/components/page/page";
import { PageTab, PageTabs } from "@/components/page/page-tabs";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Can } from "@/features/rbac/can";
import { downloadCsv, downloadJson } from "@/lib/csv";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../../links";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { PROJECT_STATUS, VISIBILITY_LABELS } from "../labels";
import { adminProjectQueryOptions, tasklineAdminMutations } from "../queries";
import type { ProjectExport } from "../schema";

const DeleteProjectDialog = lazy(() => import("./delete-project-dialog"));
const SaveTemplateDialog = lazy(() => import("../templates/save-template-dialog"));

const route = getRouteApi("/_admin/admin/taskline/projects/$id");

function download(file: ProjectExport) {
	if (file.type === "text/csv") return downloadCsv(file.filename, file.content);
	downloadJson(file.filename, file.content);
}

/**
 * /admin/taskline/projects/$id: one team project, with its tabs (details, members,
 * workflow, labels) and what only the admin does: archive or restore, export, delete
 * by typing the key. "Open in Taskline" opens it where its members work.
 */
export function AdminProjectLayout() {
	const { id } = route.useParams();
	const { data: project } = useSuspenseQuery(adminProjectQueryOptions(id));
	const [deleting, setDeleting] = useState(false);
	const [savingTemplate, setSavingTemplate] = useState(false);
	const archive = useCrudMutation(tasklineAdminMutations.setProjectArchived(), { invalidate: ALL_TASKLINE_ADMIN });
	const exporter = useCrudMutation(tasklineAdminMutations.exportProject(), { invalidate: [] });

	const exportAs = (format: "json" | "csv") => exporter.mutate({ id, format }, { onSuccess: (file) => download(file) });

	return (
		<Page width="admin" data-testid="taskline-admin-project">
			<PageHeader
				title={project.name}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<span className="font-mono">{project.key}</span>
						<span aria-hidden>·</span>
						<span>{VISIBILITY_LABELS[project.visibility]()}</span>
						<StatusOf status={project.status} map={PROJECT_STATUS} />
					</span>
				}
				actions={
					<>
						<Button variant="outline" asChild>
							<Link {...tasklineLinks.project(project.ws, project.key)} data-testid="open-in-taskline">
								<ExternalLinkIcon aria-hidden />
								{m.taskline_admin_open_in_app()}
							</Link>
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" disabled={exporter.isPending} data-testid="project-export">
									<DownloadIcon aria-hidden />
									{m.taskline_admin_export()}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={() => exportAs("json")}>{m.taskline_admin_export_json()}</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => exportAs("csv")}>{m.taskline_admin_export_csv()}</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<Can permission="taskline:configure">
							<Button variant="outline" onClick={() => setSavingTemplate(true)} data-testid="project-save-template">
								<LayoutTemplateIcon aria-hidden />
								{m.taskline_template_save()}
							</Button>
						</Can>
						<Can permission="taskline:manage">
							<Button
								variant="outline"
								disabled={archive.isPending}
								onClick={() =>
									archive.mutate(
										{ id, archived: !project.archived },
										{
											onSuccess: () =>
												toast.success(
													project.archived ? m.taskline_admin_toast_unarchived() : m.taskline_admin_toast_archived(),
												),
										},
									)
								}
								data-testid="project-archive"
							>
								{project.archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
								{project.archived ? m.taskline_admin_unarchive() : m.taskline_admin_archive()}
							</Button>
							<Button variant="destructive" onClick={() => setDeleting(true)} data-testid="project-delete">
								<Trash2Icon aria-hidden />
								{m.crud_delete()}
							</Button>
						</Can>
					</>
				}
				tabs={
					<PageTabs label={m.taskline_admin_project_tabs()}>
						<PageTab to="/admin/taskline/projects/$id" params={{ id }} activeOptions={{ exact: true }}>
							<FileTextIcon aria-hidden />
							{m.taskline_admin_tab_details()}
						</PageTab>
						<PageTab to="/admin/taskline/projects/$id/members" params={{ id }} data-testid="tab-members">
							<UsersIcon aria-hidden />
							{m.taskline_admin_tab_members()}
						</PageTab>
						<PageTab to="/admin/taskline/projects/$id/workflow" params={{ id }}>
							<ListChecksIcon aria-hidden />
							{m.taskline_admin_tab_workflow()}
						</PageTab>
						<PageTab to="/admin/taskline/projects/$id/labels" params={{ id }}>
							<TagIcon aria-hidden />
							{m.taskline_admin_tab_labels()}
						</PageTab>
					</PageTabs>
				}
			/>
			<Outlet />
			{deleting ? (
				<Suspense fallback={null}>
					<DeleteProjectDialog project={project} onClose={() => setDeleting(false)} />
				</Suspense>
			) : null}
			{savingTemplate ? (
				<Suspense fallback={null}>
					<SaveTemplateDialog
						projectId={project.id}
						projectName={project.name}
						onClose={() => setSavingTemplate(false)}
					/>
				</Suspense>
			) : null}
		</Page>
	);
}
