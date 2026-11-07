import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
	CheckIcon,
	ChevronsUpDownIcon,
	ClockIcon,
	FlaskConicalIcon,
	FolderKanbanIcon,
	HouseIcon,
	InboxIcon,
	PlusIcon,
	SearchIcon,
	UsersIcon,
} from "lucide-react";
import { lazy, type ReactNode, Suspense, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { sessionQueryOptions } from "@/features/auth/queries";
import { useHotkeyLabel } from "@/hooks/use-hotkeys";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { TASKLINE_NAME } from "../brand";
import { tasklineColor } from "../colors";
import { tasklineLinks } from "../links";
import { unreadQueryOptions } from "../queries";
import type { NavProject, NavWorkspace, TasklineNav } from "../types";
import { TasklineMark } from "./taskline-mark";
import { TasklineUserMenu } from "./taskline-user-menu";

// Loaded when opened: its form isn't on every page.
const NewTaskDialog = lazy(() => import("./new-task-dialog"));

/** The workspace the page is in (its `$ws`), else the first one the caller has. */
export function useCurrentWorkspace(workspaces: ReadonlyArray<NavWorkspace>): NavWorkspace | undefined {
	const params = useParams({ strict: false });
	return workspaces.find((workspace) => workspace.segment === params.ws) ?? workspaces[0];
}

export const WORKSPACE_ICONS = { team: UsersIcon, sandbox: FlaskConicalIcon } as const;

/**
 * Taskline's sidebar (PLAN 11.5): the wordmark, the workspace switcher (only for
 * someone with both the team and a sandbox), Home, the workspace's projects, search
 * (the palette), and the starred and recently worked-on projects, with the user at
 * the bottom. It collapses to icons on desktop and is a sheet on phones, like the admin's.
 */
export function TasklineSidebar({ nav, onOpenPalette }: { nav: TasklineNav; onOpenPalette: () => void }) {
	const current = useCurrentWorkspace(nav.workspaces);
	const shortcut = useHotkeyLabel("mod+k");
	const params = useParams({ strict: false });
	const { data: session } = useQuery(sessionQueryOptions());
	const [creating, setCreating] = useState(false);
	// Polled every minute (PLAN 11.5); it appears after hydration, absolutely placed, so nothing moves.
	const { data: unread } = useQuery({ ...unreadQueryOptions(session?.user.id ?? ""), enabled: Boolean(session) });
	const unreadCount = unread?.unread ?? 0;
	return (
		<Sidebar collapsible="icon" data-testid="taskline-sidebar">
			<nav aria-label={m.taskline_sidebar_label()} className="flex min-h-0 flex-1 flex-col">
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild size="lg" tooltip={TASKLINE_NAME}>
								<Link {...tasklineLinks.home()}>
									<TasklineMark className="size-7" />
									<span className="truncate font-semibold text-heading tracking-tight">{TASKLINE_NAME}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
						{nav.workspaces.length > 1 && current ? (
							<WorkspaceSwitcher workspaces={nav.workspaces} current={current} />
						) : null}
					</SidebarMenu>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<NavItem label={m.taskline_nav_home()}>
									{(props) => (
										<Link {...tasklineLinks.home()} {...props}>
											<HouseIcon aria-hidden />
											<span>{m.taskline_nav_home()}</span>
										</Link>
									)}
								</NavItem>
								<NavItem
									label={m.taskline_inbox()}
									badge={
										unreadCount > 0 ? (
											<SidebarMenuBadge
												aria-hidden
												className="pointer-events-none bg-primary text-primary-foreground"
												data-testid="nav-inbox-badge"
											>
												{unreadCount > 99 ? "99+" : formatNumber(unreadCount)}
											</SidebarMenuBadge>
										) : null
									}
								>
									{(props) => (
										<Link {...tasklineLinks.inbox()} {...props} data-testid="nav-inbox">
											<InboxIcon aria-hidden />
											<span>{m.taskline_inbox()}</span>
											{unreadCount > 0 ? (
												<span className="sr-only">
													{m.taskline_inbox_unread_count({ count: formatNumber(unreadCount) })}
												</span>
											) : null}
										</Link>
									)}
								</NavItem>
								{current ? (
									<NavItem label={m.taskline_nav_timesheet()}>
										{(props) => (
											<Link {...tasklineLinks.timesheet(current.segment)} {...props} data-testid="nav-timesheet">
												<ClockIcon aria-hidden />
												<span>{m.taskline_nav_timesheet()}</span>
											</Link>
										)}
									</NavItem>
								) : null}
								{current ? (
									<NavItem label={m.taskline_nav_projects()}>
										{(props) => (
											<Link {...tasklineLinks.projects(current.segment)} {...props}>
												<FolderKanbanIcon aria-hidden />
												<span>{m.taskline_nav_projects()}</span>
											</Link>
										)}
									</NavItem>
								) : null}
								{nav.projects.length > 0 ? (
									<SidebarMenuItem>
										<SidebarMenuButton
											tooltip={m.taskline_new_task()}
											onClick={() => setCreating(true)}
											data-testid="taskline-new-task"
										>
											<PlusIcon aria-hidden />
											<span>{m.taskline_new_task()}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								) : null}
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip={m.taskline_nav_search()}
										onClick={onOpenPalette}
										aria-keyshortcuts="Control+K Meta+K"
										data-testid="taskline-search"
									>
										<SearchIcon aria-hidden />
										<span>{m.taskline_nav_search()}</span>
										{/* Fixed width: swapping "Ctrl" for "⌘" after hydration never moves anything. */}
										<Kbd className="ms-auto w-12 group-data-[collapsible=icon]:hidden" aria-hidden>
											{shortcut}
										</Kbd>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
					<ProjectGroup
						label={m.taskline_nav_starred()}
						projects={nav.starred}
						several={nav.workspaces.length > 1}
						testId="nav-starred"
					/>
					<ProjectGroup
						label={m.taskline_nav_recent()}
						projects={nav.recent}
						several={nav.workspaces.length > 1}
						testId="nav-recent"
					/>
				</SidebarContent>
				<SidebarFooter>
					<TasklineUserMenu variant="sidebar" />
				</SidebarFooter>
				<SidebarRail />
			</nav>
			<Suspense fallback={null}>
				{creating && session ? (
					<NewTaskDialog
						userId={session.user.id}
						projects={nav.projects}
						current={params.ws && params.key ? { ws: params.ws, key: params.key } : null}
						onClose={() => setCreating(false)}
					/>
				) : null}
			</Suspense>
		</Sidebar>
	);
}

/** Props every sidebar link takes: the router marks the current page (data-active); on phones the sheet closes once one is picked. */
type NavLinkProps = { activeProps: { "data-active": true }; onClick: () => void };

function NavItem({
	label,
	badge,
	children,
}: {
	label: string;
	/** A count beside the item (the inbox's unread); the link says it to screen readers itself. */
	badge?: ReactNode;
	children: (props: NavLinkProps) => ReactNode;
}) {
	const { setOpenMobile } = useSidebar();
	return (
		<SidebarMenuItem>
			<SidebarMenuButton asChild tooltip={label} className="data-[active=true]:[&>svg]:text-primary">
				{children({ activeProps: { "data-active": true }, onClick: () => setOpenMobile(false) })}
			</SidebarMenuButton>
			{badge}
		</SidebarMenuItem>
	);
}

/** A project's colour, as a dot in front of its name. */
export function ProjectDot({ project, className }: { project: Pick<NavProject, "color">; className?: string }) {
	return (
		<span
			aria-hidden
			className={className ?? "size-2.5 shrink-0 rounded-full"}
			style={{ backgroundColor: tasklineColor(project.color) }}
		/>
	);
}

/** `several`: the caller has the team and a sandbox, so a sandbox project carries the sandbox's icon (both may have a WEB). */
function ProjectGroup({
	label,
	projects,
	several,
	testId,
}: {
	label: string;
	projects: NavProject[];
	several: boolean;
	testId: string;
}) {
	const { setOpenMobile } = useSidebar();
	if (projects.length === 0) return null;
	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden" data-testid={testId}>
			<SidebarGroupLabel>{label}</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{projects.map((project) => (
						<SidebarMenuItem key={project.id}>
							<SidebarMenuButton asChild>
								<Link
									{...tasklineLinks.project(project.ws, project.key)}
									activeProps={{ "data-active": true }}
									onClick={() => setOpenMobile(false)}
								>
									<ProjectDot project={project} />
									<span className="truncate">{project.name}</span>
									<span className="ms-auto font-mono text-caption text-muted-foreground">{project.key}</span>
									{several && project.workspaceKind === "sandbox" ? (
										<>
											<FlaskConicalIcon className="size-3 text-muted-foreground" aria-hidden />
											<span className="sr-only">{m.taskline_workspace_sandbox()}</span>
										</>
									) : null}
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

/** The team or the caller's sandbox: switching opens that workspace's projects. */
function WorkspaceSwitcher({
	workspaces,
	current,
}: {
	workspaces: ReadonlyArray<NavWorkspace>;
	current: NavWorkspace;
}) {
	const Icon = WORKSPACE_ICONS[current.kind];
	return (
		<SidebarMenuItem>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<SidebarMenuButton tooltip={current.name} className="border bg-background" data-testid="workspace-switcher">
						<Icon aria-hidden />
						<span className="flex min-w-0 flex-col leading-tight">
							<span className="sr-only">{m.taskline_workspace_switch()}: </span>
							<span className="truncate font-medium">{current.name}</span>
						</span>
						<ChevronsUpDownIcon className="ms-auto text-muted-foreground" aria-hidden />
					</SidebarMenuButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="min-w-56">
					<DropdownMenuLabel className="text-caption text-muted-foreground">
						{m.taskline_workspace_label()}
					</DropdownMenuLabel>
					{workspaces.map((workspace) => {
						const ItemIcon = WORKSPACE_ICONS[workspace.kind];
						return (
							<DropdownMenuItem key={workspace.id} asChild>
								<Link {...tasklineLinks.projects(workspace.segment)}>
									<ItemIcon aria-hidden />
									<span className="flex flex-col">
										<span>{workspace.name}</span>
										<span className="text-caption text-muted-foreground">
											{workspace.kind === "team" ? m.taskline_workspace_team() : m.taskline_workspace_sandbox()}
										</span>
									</span>
									{workspace.id === current.id ? <CheckIcon className="ms-auto" aria-hidden /> : null}
								</Link>
							</DropdownMenuItem>
						);
					})}
				</DropdownMenuContent>
			</DropdownMenu>
		</SidebarMenuItem>
	);
}
