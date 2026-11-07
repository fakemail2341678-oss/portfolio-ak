import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArchiveIcon, FolderKanbanIcon, LayoutGridIcon, ListIcon, LockIcon, PlusIcon, StarIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { projectsQueryOptions, starProjectMutation, workspaceQueryOptions } from "../queries";
import { ProjectDot } from "../shell/taskline-sidebar";
import type { ProjectSummary } from "../types";

const CreateProjectDialog = lazy(() => import("./create-project-dialog"));

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/projects");

/**
 * /app/taskline/$ws/projects: the projects the caller may see in the workspace, as
 * cards or a list (`?view=`), the archived ones on request (`?archived=1`), stars,
 * and "New project" for those allowed (`?create=1` opens the dialog, so the palette
 * can too).
 */
export function ProjectDirectory() {
	const { session } = route.useRouteContext();
	const { ws } = route.useParams();
	const search = route.useSearch();
	const navigate = useNavigate({ from: "/app/taskline/$ws/projects" });
	const userId = session.user.id;
	const archived = search.archived === 1;
	const { data: view } = useSuspenseQuery(workspaceQueryOptions(userId, ws));
	const { data: projects } = useSuspenseQuery(projectsQueryOptions(userId, ws, archived));
	const list = search.view === "list";
	const setCreating = (open: boolean) =>
		void navigate({ search: (previous) => ({ ...previous, create: open ? 1 : undefined }), replace: true });

	return (
		<Page width="admin" className="mx-auto max-w-6xl" data-testid="project-directory">
			<PageHeader
				title={archived ? m.taskline_projects_archived_title() : m.taskline_nav_projects()}
				description={view.workspace.name}
				actions={
					<>
						<div className="flex rounded-md border p-0.5">
							<ViewLink current={!list} view="cards" icon={LayoutGridIcon} label={m.taskline_projects_view_cards()} />
							<ViewLink current={list} view="list" icon={ListIcon} label={m.taskline_projects_view_list()} />
						</div>
						<Button asChild variant="ghost" size="sm">
							<Link
								from="/app/taskline/$ws/projects"
								search={(previous) => ({ ...previous, archived: archived ? undefined : 1 })}
							>
								<ArchiveIcon aria-hidden />
								{archived ? m.taskline_projects_show_active() : m.taskline_projects_show_archived()}
							</Link>
						</Button>
						{view.canCreateProject ? (
							<Button size="sm" onClick={() => setCreating(true)} data-testid="new-project">
								<PlusIcon aria-hidden />
								{m.taskline_project_new()}
							</Button>
						) : null}
					</>
				}
			/>
			{projects.length === 0 ? (
				<EmptyState
					icon={FolderKanbanIcon}
					title={archived ? undefined : m.taskline_projects_empty_title()}
					description={
						archived
							? m.taskline_projects_archived_empty()
							: view.canCreateProject
								? m.taskline_projects_empty_create()
								: m.taskline_projects_empty_member()
					}
					primaryAction={
						!archived && view.canCreateProject ? (
							<Button onClick={() => setCreating(true)}>
								<PlusIcon aria-hidden />
								{m.taskline_project_new()}
							</Button>
						) : undefined
					}
				/>
			) : list ? (
				<ProjectTable projects={projects} ws={ws} userId={userId} canStar={view.me !== null} />
			) : (
				<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="project-cards">
					{projects.map((project) => (
						<li key={project.id}>
							<ProjectCard project={project} ws={ws} userId={userId} canStar={view.me !== null} />
						</li>
					))}
				</ul>
			)}
			{search.create === 1 && view.canCreateProject ? (
				<Suspense>
					<CreateProjectDialog ws={ws} userId={userId} onClose={() => setCreating(false)} />
				</Suspense>
			) : null}
		</Page>
	);
}

function ViewLink({
	current,
	view,
	icon: Icon,
	label,
}: {
	current: boolean;
	view: "cards" | "list";
	icon: typeof ListIcon;
	label: string;
}) {
	return (
		<Link
			from="/app/taskline/$ws/projects"
			search={(previous) => ({ ...previous, view: view === "cards" ? undefined : view })}
			aria-current={current ? "page" : undefined}
			className={cn(
				"inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
				current && "bg-surface-2 text-foreground",
			)}
		>
			<Icon className="size-4" aria-hidden />
			<span className="sr-only">{label}</span>
		</Link>
	);
}

function StarButton({ project, ws, userId }: { project: ProjectSummary; ws: string; userId: string }) {
	const queryClient = useQueryClient();
	const star = useMutation({
		...starProjectMutation(queryClient, userId),
		onError: (error) => toast.error(errorMessage(error)),
	});
	const starred = star.isPending ? (star.variables?.starred ?? project.starred) : project.starred;
	return (
		<Button
			variant="ghost"
			size="icon-sm"
			aria-pressed={starred}
			onClick={() => star.mutate({ ws, key: project.key, starred: !starred })}
			data-testid={`star-${project.key}`}
		>
			<StarIcon className={cn(starred && "fill-current text-warning")} aria-hidden />
			<span className="sr-only">{m.taskline_project_star({ name: project.name })}</span>
		</Button>
	);
}

function OpenTasks({ count }: { count: number }) {
	return <span>{m.taskline_projects_open_tasks({ count: formatNumber(count) })}</span>;
}

function ProjectCard({
	project,
	ws,
	userId,
	canStar,
}: {
	project: ProjectSummary;
	ws: string;
	userId: string;
	canStar: boolean;
}) {
	return (
		<article className="relative flex h-full flex-col gap-3 rounded-xl border bg-surface-1 p-4 transition-colors hover:bg-surface-2">
			<div className="flex items-start gap-3">
				<ProjectDot project={project} className="mt-1 size-3 shrink-0 rounded" />
				<div className="flex min-w-0 flex-1 flex-col">
					<h2 className="truncate font-medium text-body">
						{/* The whole card is the link's target (the star button sits above it). */}
						<Link
							{...tasklineLinks.project(ws, project.key)}
							className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
						>
							{project.name}
						</Link>
					</h2>
					<span className="font-mono text-caption text-muted-foreground">{project.key}</span>
				</div>
				{canStar ? (
					<div className="relative">
						<StarButton project={project} ws={ws} userId={userId} />
					</div>
				) : null}
			</div>
			<div className="mt-auto flex items-center gap-3 text-caption text-muted-foreground">
				<OpenTasks count={project.openTasks} />
				{project.visibility === "private" ? (
					<span className="flex items-center gap-1">
						<LockIcon className="size-3" aria-hidden />
						{m.taskline_visibility_private()}
					</span>
				) : null}
			</div>
		</article>
	);
}

function ProjectTable({
	projects,
	ws,
	userId,
	canStar,
}: {
	projects: ProjectSummary[];
	ws: string;
	userId: string;
	canStar: boolean;
}) {
	return (
		<div className="overflow-x-auto rounded-lg border">
			<table className="w-full text-body" data-testid="project-list">
				<thead className="bg-surface-1 text-caption text-muted-foreground">
					<tr className="text-start">
						<th scope="col" className="px-4 py-2 text-start font-medium">
							{m.taskline_projects_column_name()}
						</th>
						<th scope="col" className="px-4 py-2 text-start font-medium">
							{m.taskline_projects_column_key()}
						</th>
						<th scope="col" className="px-4 py-2 text-start font-medium">
							{m.taskline_projects_column_open()}
						</th>
						<th scope="col" className="px-4 py-2 text-start font-medium">
							{m.taskline_projects_column_visibility()}
						</th>
						{canStar ? (
							<th scope="col" className="w-12 px-2 py-2">
								<span className="sr-only">{m.taskline_projects_column_star()}</span>
							</th>
						) : null}
					</tr>
				</thead>
				<tbody className="divide-y">
					{projects.map((project) => (
						<tr key={project.id}>
							<td className="px-4 py-(--row-padding)">
								<Link
									{...tasklineLinks.project(ws, project.key)}
									className="flex items-center gap-2 font-medium underline-offset-4 hover:underline"
								>
									<ProjectDot project={project} />
									{project.name}
								</Link>
							</td>
							<td className="px-4 font-mono text-caption text-muted-foreground">{project.key}</td>
							<td className="px-4 text-muted-foreground tabular-nums">{formatNumber(project.openTasks)}</td>
							<td className="px-4 text-muted-foreground">
								{project.visibility === "private" ? m.taskline_visibility_private() : m.taskline_visibility_team()}
							</td>
							{canStar ? (
								<td className="px-2">
									<StarButton project={project} ws={ws} userId={userId} />
								</td>
							) : null}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
