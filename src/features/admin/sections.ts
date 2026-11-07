import { type ActiveOptions, linkOptions } from "@tanstack/react-router";
import {
	BanIcon, // @parda
	BriefcaseIcon, // @portfolio
	ChartColumnIcon, // @taskline
	ChartNoAxesColumnIcon, // @parda
	DatabaseIcon,
	FlagIcon, // @parda
	FlaskConicalIcon, // @parda
	FolderKanbanIcon, // @portfolio
	GalleryHorizontalIcon, // @parda
	GaugeIcon, // @taskline
	HistoryIcon, // @taskline
	ImagesIcon, // @portfolio
	InboxIcon, // @portfolio
	KeyRoundIcon,
	LayersIcon, // @parda
	LayoutGridIcon, // @apps
	LayoutTemplateIcon, // @taskline
	Link2Icon, // @apps
	ListChecksIcon, // @taskline
	type LucideIcon,
	NotebookPenIcon, // @portfolio
	PaletteIcon,
	QuoteIcon, // @portfolio
	RowsIcon, // @parda
	ScrollTextIcon,
	ServerIcon, // @parda
	SettingsIcon, // @taskline
	ShieldCheckIcon,
	SlidersHorizontalIcon, // @parda
	SquareKanbanIcon, // @taskline
	TablePropertiesIcon, // @taskline
	TimerIcon, // @taskline
	UserRoundIcon, // @portfolio
	UsersIcon,
	UsersRoundIcon, // @taskline
	WorkflowIcon, // @portfolio
	WrenchIcon, // @portfolio
	ZapIcon, // @taskline
} from "lucide-react";
import { PARDA_NAME } from "@/features/parda/brand"; // @parda
import type { Permission } from "@/features/rbac/permissions";
import { TASKLINE_NAME } from "@/features/taskline/brand"; // @taskline
import { m } from "@/paraglide/messages";
import type { FileRouteTypes } from "@/routeTree.gen";

/** Every admin page without a path param: what a section can link to. */
export type AdminPath = Exclude<Extract<FileRouteTypes["to"], `/admin/${string}`>, `${string}$${string}`>;

/** Sidebar groups, in order. The portfolio and the apps fill theirs in later tasks. */
export const ADMIN_GROUPS = [
	"overview",
	"portfolio",
	"apps",
	"taskline", // @taskline
	"parda", // @parda
	"access",
	"system",
] as const;
export type AdminGroup = (typeof ADMIN_GROUPS)[number];

export const ADMIN_GROUP_LABELS: Record<AdminGroup, () => string> = {
	overview: m.admin_group_overview,
	portfolio: m.admin_group_portfolio,
	apps: m.admin_group_apps,
	taskline: () => TASKLINE_NAME, // @taskline
	parda: () => PARDA_NAME, // @parda
	access: m.admin_group_access,
	system: m.admin_group_system,
};

/**
 * The admin area's sections, in sidebar order within their group. The sidebar, the
 * command palette and the dashboard show only those whose `permission` the user
 * holds; each route also checks it in `beforeLoad`, and each server function checks
 * its own.
 */
export type AdminSection = {
	/** The link (a typed `linkOptions` object, spread in): where it goes and when it counts as current. */
	to: AdminPath;
	activeOptions?: ActiveOptions;
	label: () => string;
	description: () => string;
	icon: LucideIcon;
	/** What opening it takes; null for personal pages any admin-area user may open. */
	permission: Permission | null;
	group: AdminGroup;
	/** Extra words the command palette matches (space-separated, localized). */
	keywords?: () => string;
};

export const ADMIN_SECTIONS: ReadonlyArray<AdminSection> = [
	{
		...linkOptions({ to: "/admin/test-crud" }),
		label: m.admin_nav_test_crud,
		description: m.test_crud_admin_description,
		icon: DatabaseIcon,
		permission: "test-crud:read",
		group: "overview",
		keywords: m.admin_keywords_test_crud,
	},
	// portfolio:start
	{
		...linkOptions({ to: "/admin/portfolio/profile" }),
		label: m.admin_nav_portfolio_profile,
		description: m.portfolio_admin_profile_description,
		icon: UserRoundIcon,
		permission: "portfolio:read",
		group: "portfolio",
		keywords: m.admin_keywords_portfolio_profile,
	},
	{
		...linkOptions({ to: "/admin/portfolio/projects" }),
		label: m.admin_nav_portfolio_projects,
		description: m.portfolio_admin_projects_description,
		icon: FolderKanbanIcon,
		permission: "portfolio:read",
		group: "portfolio",
		keywords: m.admin_keywords_portfolio_projects,
	},
	{
		...linkOptions({ to: "/admin/portfolio/journal" }),
		label: m.admin_nav_portfolio_posts,
		description: m.portfolio_admin_posts_description,
		icon: NotebookPenIcon,
		permission: "portfolio:read",
		group: "portfolio",
		keywords: m.admin_keywords_portfolio_posts,
	},
	{
		...linkOptions({ to: "/admin/portfolio/experience" }),
		label: m.admin_nav_portfolio_experience,
		description: m.portfolio_admin_experience_description,
		icon: BriefcaseIcon,
		permission: "portfolio:read",
		group: "portfolio",
		keywords: m.admin_keywords_portfolio_experience,
	},
	{
		...linkOptions({ to: "/admin/portfolio/skills" }),
		label: m.admin_nav_portfolio_skills,
		description: m.portfolio_admin_skills_description,
		icon: WrenchIcon,
		permission: "portfolio:read",
		group: "portfolio",
		keywords: m.admin_keywords_portfolio_skills,
	},
	{
		...linkOptions({ to: "/admin/portfolio/process" }),
		label: m.admin_nav_portfolio_process,
		description: m.portfolio_admin_process_description,
		icon: WorkflowIcon,
		permission: "portfolio:read",
		group: "portfolio",
		keywords: m.admin_keywords_portfolio_process,
	},
	{
		...linkOptions({ to: "/admin/portfolio/testimonials" }),
		label: m.admin_nav_portfolio_testimonials,
		description: m.portfolio_admin_testimonials_description,
		icon: QuoteIcon,
		permission: "portfolio:read",
		group: "portfolio",
		keywords: m.admin_keywords_portfolio_testimonials,
	},
	{
		...linkOptions({ to: "/admin/portfolio/messages" }),
		label: m.admin_nav_messages,
		description: m.messages_description,
		icon: InboxIcon,
		permission: "messages:read",
		group: "portfolio",
		keywords: m.admin_keywords_messages,
	},
	{
		...linkOptions({ to: "/admin/media" }),
		label: m.admin_nav_media,
		description: m.media_description,
		icon: ImagesIcon,
		permission: "media:read",
		group: "portfolio",
		keywords: m.admin_keywords_media,
	},
	// portfolio:end
	// apps:start
	{
		...linkOptions({ to: "/admin/apps" }),
		label: m.admin_nav_apps,
		description: m.apps_usage_description,
		icon: LayoutGridIcon,
		permission: "apps:read",
		group: "apps",
		keywords: m.admin_keywords_apps,
	},
	{
		...linkOptions({ to: "/admin/links" }),
		label: m.admin_nav_links,
		description: m.links_moderation_description,
		icon: Link2Icon,
		permission: "links:moderate",
		group: "apps",
		keywords: m.admin_keywords_links,
	},
	// apps:end
	// taskline:start
	{
		// Only on this exact path: the other Taskline sections are under it.
		...linkOptions({ to: "/admin/taskline", activeOptions: { exact: true } }),
		label: m.admin_nav_taskline,
		description: m.taskline_admin_overview_description,
		icon: GaugeIcon,
		permission: "taskline:read",
		group: "taskline",
		keywords: m.admin_keywords_taskline,
	},
	{
		...linkOptions({ to: "/admin/taskline/projects" }),
		label: m.admin_nav_taskline_projects,
		description: m.taskline_admin_projects_description,
		icon: SquareKanbanIcon,
		permission: "taskline:read",
		group: "taskline",
		keywords: m.admin_keywords_taskline_projects,
	},
	{
		...linkOptions({ to: "/admin/taskline/members" }),
		label: m.admin_nav_taskline_members,
		description: m.taskline_admin_members_description,
		icon: UsersRoundIcon,
		permission: "taskline:read",
		group: "taskline",
		keywords: m.admin_keywords_taskline_members,
	},
	{
		...linkOptions({ to: "/admin/taskline/workflows" }),
		label: m.admin_nav_taskline_workflows,
		description: m.taskline_admin_workflows_description,
		icon: ListChecksIcon,
		permission: "taskline:configure",
		group: "taskline",
		keywords: m.admin_keywords_taskline_workflows,
	},
	{
		...linkOptions({ to: "/admin/taskline/fields" }),
		label: m.admin_nav_taskline_fields,
		description: m.taskline_admin_fields_description,
		icon: TablePropertiesIcon,
		permission: "taskline:configure",
		group: "taskline",
		keywords: m.admin_keywords_taskline_fields,
	},
	{
		...linkOptions({ to: "/admin/taskline/automations" }),
		label: m.admin_nav_taskline_automations,
		description: m.taskline_admin_automations_description,
		icon: ZapIcon,
		permission: "taskline:configure",
		group: "taskline",
		keywords: m.admin_keywords_taskline_automations,
	},
	{
		...linkOptions({ to: "/admin/taskline/templates" }),
		label: m.admin_nav_taskline_templates,
		description: m.taskline_admin_templates_description,
		icon: LayoutTemplateIcon,
		permission: "taskline:configure",
		group: "taskline",
		keywords: m.admin_keywords_taskline_templates,
	},
	{
		...linkOptions({ to: "/admin/taskline/reports" }),
		label: m.admin_nav_taskline_reports,
		description: m.taskline_admin_reports_description,
		icon: ChartColumnIcon,
		permission: "taskline:read",
		group: "taskline",
		keywords: m.admin_keywords_taskline_reports,
	},
	{
		...linkOptions({ to: "/admin/taskline/activity" }),
		label: m.admin_nav_taskline_activity,
		description: m.taskline_admin_activity_description,
		icon: HistoryIcon,
		permission: "taskline:read",
		group: "taskline",
	},
	{
		...linkOptions({ to: "/admin/taskline/timesheets" }),
		label: m.admin_nav_taskline_timesheets,
		description: m.taskline_admin_timesheets_description,
		icon: TimerIcon,
		permission: "taskline:time",
		group: "taskline",
		keywords: m.admin_keywords_taskline_timesheets,
	},
	{
		...linkOptions({ to: "/admin/taskline/settings" }),
		label: m.admin_nav_taskline_settings,
		description: m.taskline_admin_settings_description,
		icon: SettingsIcon,
		permission: "taskline:configure",
		group: "taskline",
		keywords: m.admin_keywords_taskline_settings,
	},
	// taskline:end
	// parda:start
	{
		// Only on this exact path: the other Parda sections are under it.
		...linkOptions({ to: "/admin/parda", activeOptions: { exact: true } }),
		label: m.admin_nav_parda_overview,
		description: m.pd_admin_overview_description,
		// Its own icon: a line marker belongs to one layer, and Taskline's ChartColumnIcon goes with it (0244).
		icon: ChartNoAxesColumnIcon,
		permission: "parda:read",
		group: "parda",
		keywords: m.admin_keywords_parda_overview,
	},
	{
		...linkOptions({ to: "/admin/parda/billboard" }),
		label: m.admin_nav_parda_billboard,
		description: m.pd_admin_billboard_description,
		icon: GalleryHorizontalIcon,
		permission: "parda:read",
		group: "parda",
		keywords: m.admin_keywords_parda_billboard,
	},
	{
		...linkOptions({ to: "/admin/parda/collections" }),
		label: m.admin_nav_parda_collections,
		description: m.pd_admin_collections_description,
		icon: LayersIcon,
		permission: "parda:read",
		group: "parda",
		keywords: m.admin_keywords_parda_collections,
	},
	{
		...linkOptions({ to: "/admin/parda/layout" }),
		label: m.admin_nav_parda_layout,
		description: m.pd_admin_layout_description,
		icon: RowsIcon,
		permission: "parda:read",
		group: "parda",
		keywords: m.admin_keywords_parda_layout,
	},
	{
		...linkOptions({ to: "/admin/parda/sources" }),
		label: m.admin_nav_parda_sources,
		description: m.pd_admin_sources_description,
		icon: ServerIcon,
		permission: "parda:read",
		group: "parda",
		keywords: m.admin_keywords_parda_sources,
	},
	{
		...linkOptions({ to: "/admin/parda/titles" }),
		label: m.admin_nav_parda_titles,
		description: m.pd_admin_takedowns_description,
		icon: BanIcon,
		permission: "parda:read",
		group: "parda",
		keywords: m.admin_keywords_parda_titles,
	},
	{
		...linkOptions({ to: "/admin/parda/reports" }),
		label: m.admin_nav_parda_reports,
		description: m.pd_admin_reports_description,
		icon: FlagIcon,
		permission: "parda:read",
		group: "parda",
		keywords: m.admin_keywords_parda_reports,
	},
	{
		...linkOptions({ to: "/admin/parda/settings" }),
		label: m.admin_nav_parda_settings,
		description: m.pd_admin_settings_description,
		icon: SlidersHorizontalIcon,
		permission: "parda:read",
		group: "parda",
		keywords: m.admin_keywords_parda_settings,
	},
	{
		...linkOptions({ to: "/admin/parda/player-lab" }),
		label: m.admin_nav_parda_player_lab,
		description: m.pd_lab_description,
		icon: FlaskConicalIcon,
		permission: "parda:configure",
		group: "parda",
		keywords: m.admin_keywords_parda_player_lab,
	},
	// parda:end
	{
		...linkOptions({ to: "/admin/users" }),
		label: m.admin_nav_users,
		description: m.users_description,
		icon: UsersIcon,
		permission: "users:read",
		group: "access",
		keywords: m.admin_keywords_users,
	},
	{
		// Only on this exact path: Permissions is under it.
		...linkOptions({ to: "/admin/roles", activeOptions: { exact: true } }),
		label: m.admin_nav_roles,
		description: m.roles_description,
		icon: ShieldCheckIcon,
		permission: "roles:read",
		group: "access",
	},
	{
		...linkOptions({ to: "/admin/roles/permissions" }),
		label: m.admin_nav_permissions,
		description: m.matrix_description,
		icon: KeyRoundIcon,
		permission: "roles:read",
		group: "access",
	},
	{
		...linkOptions({ to: "/admin/audit" }),
		label: m.admin_nav_audit,
		description: m.audit_description,
		icon: ScrollTextIcon,
		permission: "audit:read",
		group: "system",
		keywords: m.admin_keywords_audit,
	},
	{
		...linkOptions({ to: "/admin/settings/appearance" }),
		label: m.admin_nav_appearance,
		description: m.appearance_description,
		icon: PaletteIcon,
		permission: null,
		group: "system",
		keywords: m.admin_keywords_appearance,
	},
	// @new-feature:admin-sections
];

/** The sections a user holding `permissions` may open, in order. */
export const permittedSections = (permissions: ReadonlyArray<Permission>) =>
	ADMIN_SECTIONS.filter((section) => section.permission === null || permissions.includes(section.permission));
