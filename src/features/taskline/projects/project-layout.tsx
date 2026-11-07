import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Outlet } from "@tanstack/react-router";
import {
	ArchiveIcon,
	CalendarDaysIcon,
	ChartColumnIcon,
	ChartGanttIcon,
	ClockIcon,
	ColumnsIcon,
	FlagIcon,
	LayoutDashboardIcon,
	ListIcon,
	ListOrderedIcon,
	LockIcon,
	SettingsIcon,
	UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/data-display/user-avatar";
import { errorMessage } from "@/components/errors/error-page";
import { Page, PageHeader } from "@/components/page/page";
import { PageTab, PageTabs } from "@/components/page/page-tabs";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { useProjectFreshness } from "../freshness";
import { tasklineLinks } from "../links";
import {
	projectMembersQueryOptions,
	projectTasksQueryOptions,
	tasklineMutations,
	workspaceQueryOptions,
} from "../queries";
import { ProjectDot } from "../shell/taskline-sidebar";
import { SANDBOX_SEGMENT } from "../types";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key");

/** At most this many faces in the header; the rest are a count. */
const FACES = 5;

/**
 * A project's frame (PLAN 11.5): its name, who is on it, and the view tabs (overview,
 * the backlog when sprints are on, board, list, calendar, timeline, milestones, time when tracked, reports, and the lead's
 * settings) around the view. It owns the page's <main>
 * and keeps the project fresh while it's open (rev polling, decision 0209).
 */
export function ProjectLayout() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const userId = session.user.id;
	const { data } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const { data: people } = useSuspenseQuery(projectMembersQueryOptions(userId, ws, key));
	const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(userId, ws));
	const queryClient = useQueryClient();
	const join = useMutation(tasklineMutations.joinProject(queryClient, userId));
	const { project } = data;
	useProjectFreshness(userId, ws, key, project.rev);
	// A team member who sees a team project they aren't on may join it (when the workspace allows; the server says).
	const canJoin =
		ws !== SANDBOX_SEGMENT &&
		project.role === null &&
		workspace.me?.role === "member" &&
		project.visibility === "team" &&
		!project.archived;
	const shown = people.slice(0, FACES);
	return (
		<Page width="wide" data-testid="project-page">
			<PageHeader
				title={
					<span className="flex items-center gap-3">
						<ProjectDot project={project} className="size-4 shrink-0 rounded" />
						{project.name}
					</span>
				}
				description={
					<span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
						<span className="font-mono">{project.key}</span>
						{/* Visibility means something in the team only: a sandbox is private to its owner. */}
						{ws === SANDBOX_SEGMENT ? null : (
							<span className="flex items-center gap-1">
								{project.visibility === "private" ? <LockIcon className="size-3" aria-hidden /> : null}
								{project.visibility === "private" ? m.taskline_visibility_private() : m.taskline_visibility_team()}
							</span>
						)}
						{project.archived ? (
							<span className="flex items-center gap-1" data-testid="project-archived">
								<ArchiveIcon className="size-3" aria-hidden />
								{m.taskline_project_archived_note()}
							</span>
						) : project.can.edit ? null : (
							<span data-testid="project-read-only">{m.taskline_project_read_only()}</span>
						)}
					</span>
				}
				actions={
					<div className="flex items-center gap-3">
						{canJoin ? (
							<Button
								variant="outline"
								size="sm"
								disabled={join.isPending}
								onClick={() =>
									join.mutate(
										{ ws, key },
										{
											onSuccess: () => toast.success(m.taskline_joined({ name: project.name })),
											onError: (error) => toast.error(errorMessage(error)),
										},
									)
								}
								data-testid="project-join"
							>
								<UserPlusIcon aria-hidden />
								{m.taskline_join()}
							</Button>
						) : null}
						<ul className="flex items-center -space-x-1.5" aria-label={m.taskline_project_people()}>
							{shown.map((member) => (
								<li key={member.memberId} title={member.name} className="rounded-md ring-2 ring-background">
									<UserAvatar name={member.name} size="sm" />
									<span className="sr-only">{member.name}</span>
								</li>
							))}
							{people.length > FACES ? (
								<li className="ps-3 text-caption text-muted-foreground tabular-nums">
									{m.taskline_project_more_people({ count: formatNumber(people.length - FACES) })}
								</li>
							) : null}
						</ul>
					</div>
				}
				tabs={
					<PageTabs label={m.taskline_views_label()}>
						<PageTab {...tasklineLinks.project(ws, key)} activeOptions={{ exact: true }} data-testid="view-overview">
							<LayoutDashboardIcon aria-hidden />
							{m.taskline_view_overview()}
						</PageTab>
						{project.settings.sprints ? (
							<PageTab {...tasklineLinks.backlog(ws, key)} data-testid="view-backlog">
								<ListOrderedIcon aria-hidden />
								{m.taskline_view_backlog()}
							</PageTab>
						) : null}
						<PageTab {...tasklineLinks.board(ws, key)} data-testid="view-board">
							<ColumnsIcon aria-hidden />
							{m.taskline_view_board()}
						</PageTab>
						<PageTab {...tasklineLinks.list(ws, key)} data-testid="view-list">
							<ListIcon aria-hidden />
							{m.taskline_view_list()}
						</PageTab>
						<PageTab {...tasklineLinks.calendar(ws, key)} data-testid="view-calendar">
							<CalendarDaysIcon aria-hidden />
							{m.taskline_view_calendar()}
						</PageTab>
						<PageTab {...tasklineLinks.timeline(ws, key)} data-testid="view-timeline">
							<ChartGanttIcon aria-hidden />
							{m.taskline_view_timeline()}
						</PageTab>
						<PageTab {...tasklineLinks.milestones(ws, key)} data-testid="view-milestones">
							<FlagIcon aria-hidden />
							{m.taskline_view_milestones()}
						</PageTab>
						{project.settings.time ? (
							<PageTab
								{...tasklineLinks.time(ws, key)}
								activeOptions={{ includeSearch: false }}
								data-testid="view-time"
							>
								<ClockIcon aria-hidden />
								{m.taskline_view_time()}
							</PageTab>
						) : null}
						<PageTab
							{...tasklineLinks.reports(ws, key)}
							activeOptions={{ includeSearch: false }}
							data-testid="view-reports"
						>
							<ChartColumnIcon aria-hidden />
							{m.taskline_view_reports()}
						</PageTab>
						{project.can.manage ? (
							<PageTab to="/app/taskline/$ws/p/$key/settings" params={{ ws, key }} data-testid="view-settings">
								<SettingsIcon aria-hidden />
								{m.taskline_view_settings()}
							</PageTab>
						) : null}
					</PageTabs>
				}
			/>
			<Outlet />
		</Page>
	);
}
